---
name: address-review
description: Close out a PR's review feedback end to end — harvest every unaddressed review comment (inline threads, review bodies, bot stickies), dispatch a panel of investigator agents that each return a fix/refute/defer verdict with evidence, apply the fixes as traceable commits, then reply to every thread and resolve the ones actually fixed so the PR carries the record. Finishes by running /simplify over the fix commits and /loop until all checks are green and the PR is ready for re-review. Use when the user invokes /address-review or asks to address, action, respond to, or clear the review comments on a pull request.
argument-hint: "[pr url | pr number] [--dry-run] [--no-loop]"
allowed-tools: "Bash, Read, Edit, Write, Grep, Glob, Agent, Skill"
---

# Address Review

The inverse of `/code-review` and `/dual-review`: those produce findings, this one **retires** them. Given a PR, it finds every piece of review feedback nobody has answered yet, decides finding-by-finding whether to fix or refute it, does the work, and leaves the answer on the PR thread where the reviewer will see it — so the next reviewer opens the PR and can tell at a glance what happened to their comments.

Two properties matter more than speed:

1. **A reply is a public claim.** "Fixed in abc123" that didn't fix it, or "this can't happen because X" where X is false, costs more trust than saying nothing. Every verdict is evidence-backed before it is posted.
2. **The fixes are unreviewed code.** A patch written to close a finding was authored quickly, under the comfortable assumption that a reviewer already reasoned it through. They didn't — they reasoned about the *defect*, not the patch. That is why `/simplify` and a self-review of the fix commits are steps, not optional extras. (See `dual-review`'s "Learning from misses" §4 for the war stories: on two separate PRs, defects a human later found had been *introduced* by fixes a review asked for, each shipping with new green tests that asserted the wrong thing.)

## Usage

```
/address-review                       # PR for the current branch
/address-review 1234                  # PR #1234
/address-review <github pr url>       # any repo the URL points at
/address-review --dry-run             # investigate + report verdicts, post nothing, change nothing
/address-review --no-loop             # stop after replies; skip /simplify and the CI loop
```

## Policy (fixed — do not renegotiate per run)

| Verdict | Reply | Resolve thread |
|---|---|---|
| **FIXED** — patch pushed | Yes, with commit SHA + one line on what changed | **Yes** |
| **ALREADY-ADDRESSED** — an earlier commit fixed it | Yes, citing the commit | **Yes** |
| **REFUTED** — reviewer's premise is wrong | Yes, with the quoted code that disproves it | **No** — the reviewer gets the last word |
| **DEFERRED** — real, but out of scope for this PR | Yes, with the follow-up issue/ticket link | **No** |
| **NEEDS-HUMAN** — product/design call, or needs info you can't get | Yes, stating the question crisply | **No** |

Never resolve a thread you didn't act on. Never resolve someone else's thread on a refutation — a resolved thread is collapsed by default in the GitHub UI, and burying a disagreement is how a review gets ignored rather than answered.

**Scope:** all reviewers — humans, review bots (CodeRabbit, Copilot, Sourcery), and this repo's own stickies (`/dual-review`, `/triage`, `/visual-recap`). Human findings outrank bot findings for attention and for tie-breaking on uncertain verdicts. A bot nit with no nameable failure and no cost may be dismissed with a one-line reply; a *human* nit gets a real answer, because a human chose to type it.

**Autonomy:** fixes are committed and pushed to the PR branch as the run proceeds. This is required for the CI loop to mean anything. Do not push to a branch that isn't the PR's head, and stop if the working tree has unrelated uncommitted changes.

## Step 1 — Preflight

```bash
gh pr view <num> --json number,title,body,url,state,isDraft,mergeable,baseRefName,headRefName,headRefOid,headRepositoryOwner
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OUT_DIR=$(mktemp -d /tmp/address-review-XXXXXX)
```

Then:

1. No PR, or the PR is merged/closed → stop and say so.
2. **Be on the PR's head branch with a clean tree.** `git status --porcelain` non-empty → stop and ask; do not stash someone's work-in-progress to make room for your commits. Local HEAD ≠ `headRefOid` → `git fetch && git checkout <headRefName> && git pull --ff-only` before anything else; refuse to proceed on a diverged local branch rather than guessing at a merge.
3. Save `gh pr diff <num> > "$OUT_DIR/pr.diff"` and the commit log since the base (`git log --oneline $(git merge-base origin/<base> HEAD)..HEAD`) — the log is what decides ALREADY-ADDRESSED verdicts.
4. Record `headRefOid` as `START_SHA`. Re-check it before every posting step (Step 5 onward): if the author force-pushed mid-run, your line numbers and your "fixed in" claims are stale — re-pull and re-verify before posting anything.

## Step 2 — Harvest every review signal

Three sources, three shapes. Missing any of them is the most common way this skill under-delivers, because reviewers put findings wherever is convenient.

**A. Inline review threads** (the primary source — carries `isResolved`, which is the whole game):

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$num:Int!,$cursor:String){
  repository(owner:$owner,name:$repo){ pullRequest(number:$num){
    reviewThreads(first:100, after:$cursor){
      pageInfo{ hasNextPage endCursor }
      nodes{ id isResolved isOutdated viewerCanResolve path line originalLine startLine diffSide
        comments(first:50){ nodes{ databaseId author{login} authorAssociation body createdAt } } } } } }' \
  -f owner=<owner> -f repo=<name> -F num=<num> > "$OUT_DIR/threads.json"
```

Paginate on `pageInfo.hasNextPage`. A 40-comment review truncated at page one silently drops half the work.

**B. Review bodies** — the summary text attached to an APPROVED / CHANGES_REQUESTED / COMMENTED review. Findings live here constantly ("three things overall: …") and they are attached to no line, so they have no thread and no resolve state:

```bash
gh api "repos/$REPO/pulls/<num>/reviews" --paginate --jq '.[] | {id,state,user:.user.login,body,submitted_at} | select(.body != "")'
```

**C. Issue-level comments** — bot stickies and drive-by human comments:

```bash
gh api "repos/$REPO/issues/<num>/comments" --paginate --jq '.[] | {id,user:.user.login,body,created_at,updated_at}'
```

### The unaddressed test

For each thread/comment, classify. Get this wrong in the permissive direction and you re-litigate settled feedback; wrong in the strict direction and you tell the reviewer you've handled things you haven't.

- `isResolved: true` → **done.** Skip it, even if you disagree. Someone made that call deliberately.
- `isOutdated: true` is **not** "addressed." It means the line moved. Code churn around a defect is the normal case, and an outdated thread whose defect survives is exactly the finding everyone stops looking at. Resolve the ambiguity by reading the *current* code at the semantic location, not the recorded line number.
- Last comment in the thread is from the PR author or you, *and* the code it cites has since changed → candidate **ALREADY-ADDRESSED**; still hand it to an investigator to confirm the change actually closes the finding. A reply saying "fixed" is a claim, not a fix.
- Anything else → **unaddressed**, in scope.
- **Explode multi-finding comments.** A `/dual-review` sticky or a CodeRabbit summary is N findings in one comment body, each needing its own verdict. Track them as separate items keyed to the parent comment, and reply once at the end with all N verdicts rather than N times.

Write the normalised work-list to `$OUT_DIR/findings.json` — one record per finding: `{id, source, thread_id, comment_id, author, is_human, path, line, quote, claim}`. Everything downstream keys off this file. If it is empty, say so and stop; there is nothing to address.

## Step 3 — Investigate (panel, one wave)

Group findings into 2–6 clusters by file/subsystem so each investigator holds one coherent area, then launch **all investigators in a single message**. Cap at 6; merge the smallest clusters rather than exceeding it. `subagent_type: general-purpose`, `model: sonnet` for clusters of nits and mechanical findings, default model for clusters touching correctness, security, state, money, or migrations.

**Investigators are read-only.** They read code, run tests, and return verdicts — they do not edit. Separating investigation from patching is what stops "I'll just fix it" from producing a patch nobody checked the premise of.

Each investigator gets: its findings, `pr.diff`, the commit log, and these rules verbatim:

1. **Read the actual code at HEAD before forming a view** — not the diff hunk the reviewer quoted. The reviewer may have read an earlier revision.
2. **Try to confirm before you refute, and try to refute before you confirm.** Both directions, every finding.
3. **REFUTED requires constructible evidence**: quote the line that makes the claim factually wrong, cite the guard that already handles it, or show the type/invariant that makes it impossible. "I don't think that happens" is not a refutation — that is NEEDS-HUMAN at best and VALID at worst.
4. **Tie goes to the reviewer.** If after honest work you can't decide, the verdict is VALID. A reviewer looking at the code saw *something*; the cost of a small unnecessary fix is far below the cost of a public wrong refutation.
5. **A finding you can settle by running something, run.** Execute the test, grep the callers, check the library's actual predicate, read the config file. Reasoning about an observable fact is how confident-and-wrong replies get written.
6. **Scope discipline.** Return the *minimum* change that closes the finding. A finding is not a licence to refactor the surrounding code; if the finding genuinely requires a larger change, say so and mark it NEEDS-HUMAN rather than quietly landing it.

Return per finding: `verdict` (VALID / REFUTED / ALREADY-ADDRESSED / DEFERRED / NEEDS-HUMAN), `evidence` (file:line + quoted code — mandatory for REFUTED and ALREADY-ADDRESSED), `fix_plan` (concrete edits + which test proves it, for VALID), `test_gap` (does an existing test already cover this? if not, name the assertion to add), `confidence`.

### Verify the refutations

**Every REFUTED verdict on a human's finding goes to a second agent that is told to defend the reviewer** before it may be posted. Refutations are the only output of this skill that can be embarrassingly wrong in public, and an investigator that has spent twenty minutes convincing itself is the worst judge of its own case. If the defender lands a hit, the verdict flips to VALID or NEEDS-HUMAN. Bot refutations skip this — nobody's time is wasted by a wrong reply to a bot.

## Step 4 — Fix

Work through the VALID findings, highest severity first, in **coherent commits** — one per finding or per tightly-related group, message naming what the reviewer asked and referencing the thread (e.g. `fix(map): restore minZoom on effect cleanup — review thread #1234 (@reviewer)`). Traceable commits are what makes the Step 5 replies checkable.

- **Never mix a fix with an unrelated cleanup.** The reviewer will diff your fix commit against their comment; noise in it reads as scope creep and costs another round.
- **Write the failing assertion first where a fix claims to make something true.** A test authored alongside a patch encodes the patch's assumptions; confirm it actually fails without the fix before you believe it.
- **Run the full local suite before pushing**, not just the touched test. Then push.
- **Re-review your own fix commits** before Step 5, running at minimum the line-by-line and cross-file angles from `dual-review` over `git diff $START_SHA..HEAD`. Ask specifically: what did the patch introduce that no existing test can observe — a loop, a lock, a background task, a mutation of state that outlives the call? That is where fixes go wrong, because the tests written with them assert the narrow original thing.

On `--dry-run`, stop at the end of Step 3, print the verdict table, and exit without editing, committing, or posting.

## Step 5 — Reply and resolve

Only now, with commits pushed and SHAs real. Re-check `headRefOid` first.

**Reply in an inline thread** (body from a file — reply bodies contain backticks and code blocks):

```bash
gh api "repos/$REPO/pulls/<num>/comments/<comment_databaseId>/replies" -F body=@"$OUT_DIR/reply-<id>.md"
```

Use the `databaseId` of the thread's **first** comment. Reply once per thread, even for a thread carrying several findings.

**Resolve** (FIXED and ALREADY-ADDRESSED only — check `viewerCanResolve` first; on a fork PR you may lack the permission, in which case say so in the reply instead of failing silently):

```bash
gh api graphql -f query='mutation($id:ID!){ resolveReviewThread(input:{threadId:$id}){ thread{ isResolved } } }' -f id=<thread_id>
```

**Review bodies and issue-level comments** have no threads to resolve. Answer them with a single issue comment addressed to the reviewer, listing that comment's findings and their verdicts.

Reply shapes — short, specific, no throat-clearing:

```markdown
Fixed in `abc1234` — the effect's cleanup now restores `minZoom` to the tile floor, and
`map.test.ts:88` fails without it.
```

```markdown
Checked this one and I don't think it holds: `_send` raises `... from exc`, so the httpx
error is preserved on `__cause__` (client.py:141) and the detail isn't lost. Leaving this
open in case I've read the wrong path.
```

```markdown
Real, but wider than this PR — the same gate is missing on three sibling panels. Tracked
in #4567 so it lands as one change rather than a partial fix here.
```

Rules for every reply:

- **State what changed and where.** "Done" is not a record; a SHA and a filename is.
- **Never claim a fix you haven't pushed.** Verify the SHA is on the remote branch before the reply mentioning it goes out.
- **Refutations are offered, not declared.** Close them with an opening — "leaving this open in case I've read the wrong path" — because you are refuting a person, and you are sometimes wrong.
- **No apologies, no praise, no restating the reviewer's comment back to them.** They wrote it.

Then post/update one sticky summary so the PR carries the whole record in one place:

```markdown
<!-- address-review-sticky -->
## ✅ Review feedback addressed

<N> findings across <M> threads · <F> fixed · <R> refuted · <D> deferred · <H> awaiting your call

| # | Finding | Verdict | Where |
|---|---|---|---|
| 1 | `src/map.tsx:88` minZoom not restored on cleanup | **Fixed** | `abc1234` |
| 2 | `client.py:141` wrapper loses the transport error | **Refuted** | [thread](<url>) |
| 3 | Sibling panels miss the same gate | **Deferred** | #4567 |

Threads for fixed items are resolved. Refuted and deferred items are left open for you.

---
*`/address-review` against `<sha7>` · <UTC timestamp>*
```

Find-and-update the sticky by its marker exactly as `dual-review` does (`gh api ... --jq '.[] | select(.body | startswith("<!-- address-review-sticky -->")) | .id'`), PATCH if found, create otherwise — re-runs must not stack duplicate summaries.

## Step 6 — Simplify

Invoke the `simplify` skill over the fix commits (`$START_SHA..HEAD`). This is a standing step, not a judgment call — fix commits are exactly the code that accumulates the redundant state, the duplicated guard, and the special case pinned on shared infrastructure, because they were written under time pressure to satisfy a specific complaint.

Apply what it finds. If you skip a finding, say why in the final summary. Commit simplifications separately from the fixes so the reviewer can read either without the other.

## Step 7 — Loop until green

Invoke the `loop` skill with no interval (self-paced) to drive the PR to all-checks-passing:

```
/loop check `gh pr checks <num>`; if anything is failing, read the failure, fix the cause, push, and keep going until every check passes
```

Guard rails the loop must carry, or it becomes an expensive way to push the same broken commit repeatedly:

- **Read the actual failure log before touching anything** (`gh run view <id> --log-failed`). Never re-push hoping.
- **Fix the cause, not the check.** Deleting an assertion, loosening a lint rule, adding a skip, or `--no-verify` are not fixes — they are the failure, laundered. If the check is genuinely wrong, that is a NEEDS-HUMAN, and the loop stops and says so.
- **A flake is a finding, not a retry.** Re-run once to confirm flakiness, then report it; do not sit re-running a nondeterministic test until it passes.
- **Stop after three unproductive rounds** — a round where nothing was learned and nothing changed. Report what is failing and why you are stuck. An agent looping silently on a red build is worse than one that gives up loudly.
- **Stop when green** — call `ScheduleWakeup` with `stop: true` rather than idling on a passing build.

Skip this step entirely on `--no-loop` or `--dry-run`.

## Step 8 — Report

Finish with, in the chat:

1. Counts by verdict, and the sticky comment URL.
2. **Every refutation, listed explicitly** — these are the claims made on the user's behalf that they may want to check.
3. Anything left NEEDS-HUMAN, phrased as the decision the user has to make.
4. CI state, and the `$OUT_DIR` path where the verdict records and investigator output live.

Do not describe the PR as "ready for re-review" unless checks are green, every thread has a reply, and nothing is NEEDS-HUMAN. Say which of those is untrue instead.
