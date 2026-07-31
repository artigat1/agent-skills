---
name: ship-pr
description: Babysit a pull request until it is actually shippable — mark it ready for review, loop on CI, fix failures, work through AI-reviewer feedback, keep it mergeable with the base branch, and optionally squash-merge and watch the deploy. Finishes by sending a Slack DM summary with links to the PR, the CI run and any deployment. Use when the user invokes /ship-pr or asks to ship, babysit, land, or get a PR green and merged.
argument-hint: "[pr url | pr number] [--merge] [--no-merge]"
allowed-tools: "Bash, Read, Edit, Write, Grep, Glob, Skill"
---

# Ship PR

Babysit a PR. Iterate with CI and the AI reviewers until it is green and the
feedback is answered. Merge it if that was asked for or the change is clearly
low risk. Then send a Slack summary.

## Usage

```
/ship-pr                    # PR for the current branch
/ship-pr 1234               # PR #1234
/ship-pr <github pr url>    # any repo the URL points at
/ship-pr --merge            # squash-merge once green, then watch the deploy
/ship-pr --no-merge         # stop at green; never merge
```

## Step 0 — Resolve the PR

Everything below operates on **one** PR, resolved once, up front:

```bash
gh pr view ${ARG:-} --json number,url,title,state,isDraft,mergeable,mergeStateStatus,baseRefName,headRefName,headRefOid,statusCheckRollup
```

- No argument → the PR for the current branch. No PR for the current branch →
  stop and say so; do not create one.
- Merged or closed → stop and say so.
- Record `number`, `url`, `headRefName` and `baseRefName`. Every `gh` call from
  here on passes the PR number explicitly — never rely on the checked-out
  branch still being the right one halfway through a long loop.
- Be on the PR's head branch with a clean tree before making any commits.
  `git status --porcelain` non-empty → stop and ask.

## Loop

1. **Mark ready** — if the PR is a draft, `gh pr ready <num>`. (Already ready →
   skip; this is not an error.)
2. **Wait for CI** — `gh pr checks <num> --watch`. For long runs, prefer
   `/loop` over a busy-wait so the session stays interruptible.
3. **Fix what's red, answer what's valid.**
   - Failing checks: read the actual job log (`gh run view <id> --log-failed`)
     before touching code. Fix the cause, not the symptom.
   - AI-reviewer feedback: address what's valid; ignore insignificant nits,
     already-fixed items, and things that are simply wrong. `/address-review`
     does this properly — investigate, fix or refute with evidence, reply, and
     resolve the threads it actually fixed. Compose it here rather than
     re-deriving the workflow.
   - Mergeability: `mergeStateStatus` of `BEHIND` or `DIRTY` → rebase on the
     base branch and force-push with `--force-with-lease`.
4. **Green, mergeable, no valid feedback outstanding → break.**
5. Otherwise push and repeat from 2.

Cap the loop at a sane number of rounds (~5). If it is still red after that,
stop and report what is failing rather than grinding — a check that survives
five fix attempts usually needs a human decision.

## Merge and deploy — if requested, or the change is low risk

Only when `--merge` was passed, the user asked, or the change is genuinely low
risk (small, well-covered, reversible, no schema/auth/payment/infra surface).
When in doubt, don't — leave it green and say it's ready.

```bash
gh pr merge <num> --squash --delete-branch
```

Then watch the post-merge CI/deploy run on the base branch
(`gh run watch <id>`) and note whether the deploy succeeded — the Slack message
should say so either way.

Useful without leaving the shell: `gh pr checks <num> --json` for check-run
status, and `gh api` for one-off authenticated GitHub calls.

## Done → Slack

When finished — merged or not, green or given up — send **Steve a Slack DM**
with the summary and the relevant links.

Use `mcp__claude_ai_Slack__slack_send_message` with `channel_id: "USADUHL3Z"`
(Steve's own user ID — sending to a user ID opens the DM). Send it directly;
this is a summary of work already done, not a message that needs review first.

Keep it short and scannable — this lands on a phone:

```
*<pr title>* — merged ✅ / ready to merge 🟢 / needs you ❌

<one line: what the change does>
<one line: what happened — e.g. "3 CI rounds, fixed a flaky snapshot test + 2 CodeRabbit findings">

PR: <pr url>
CI: <run url>
Deploy: <deployment url>          # omit if nothing deployed
```

Include only links that exist; a dead "Deploy:" line is worse than no line.
If the Slack MCP tools are unavailable, print the message in the transcript and
say it couldn't be sent — do not silently skip it.

## Provenance

Adapted from
[kentcdodds/kcd-skills](https://github.com/kentcdodds/kcd-skills/tree/main/skills/ship-pr)
(MIT, © 2026 Kent C. Dodds). Changes from upstream:

- **Discord → Slack.** The done-notification is a Slack DM to Steve via the
  Slack MCP server, replacing upstream's `kody:@kentcdodds/discord/post-message`
  script and its hardcoded channel.
- **`kody:` tooling → `gh`.** Upstream drives GitHub through Kent's personal
  `kody:@kentcdodds/github/*` package (`pr/set-review-status`, `pr/merge`,
  `pr/get-checks`, `request`, `graphql`), which nobody else has. Those are
  replaced with `gh pr ready`, `gh pr merge --squash`, `gh pr checks` and
  `gh api`.
- **Explicit PR resolution (Step 0).** Upstream assumes the PR is already
  identified. This version resolves it once from an argument or the current
  branch and threads that number through every command.
- **Loop cap and preflight.** Added a round limit, a clean-tree check, and the
  mergeability handling that upstream mentions only in passing.
