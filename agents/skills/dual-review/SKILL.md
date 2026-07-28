---
name: dual-review
description: Dual-model code review of a large PR — the diff is triaged and partitioned, a Claude panel reviews each partition against a nine-angle checklist (line-by-line, removed-behavior, cross-file, security, reuse, simplification, efficiency, altitude, devil's advocate), a Codex sweep reads the top-risk areas independently, and major candidate findings are adversarially verified by the OTHER model before entering the report (all candidates with --thorough). Runs to a ~10-minute wall-clock budget by default. Only a concise, agent-actionable summary (location + problem + fix per finding) is posted as a sticky PR comment — the full report is kept locally and never posted. Use when the user invokes /dual-review or asks for a dual review, a Claude + Codex review, or a multi-model panel review of a PR — intended for PRs too large to review by hand.
---

# Dual Review (Claude × Codex)

A funnel review for **large PRs**: triage the diff into coherent partitions → Claude reviewers cover each partition with the full angle checklist (bounded attention per reviewer) → a Codex sweep reads the top-risk areas independently (cross-model recall) → critical/major candidates from either model are **adversarially verified by the other model** before they lead the report (every candidate, in `--thorough` mode). The cross-model confidence signal is "found by one model and survived refutation by the other" — as strong in practice as independent double-discovery, at a fraction of the cost, because verification prompts are small and focused while discovery sweeps read the whole diff. The default mode runs to a hard ~10-minute wall-clock budget (see Speed budget); `--thorough` trades time for exhaustiveness.

The angle checklist mirrors the built-in `/code-review` skill (its 7 finder angles) plus security and devil's advocate, so a dual review covers everything a high-effort `/code-review` covers. Do NOT delegate the Claude side to the `/code-review` skill itself while Codex is in the loop: it returns only its final capped JSON and runs its own verify phase, which loses the raw candidates this skill's cross-model verification needs. (The tiny-diff single-model fallback in Step 2 is the one exception — with no cross-verification to feed, delegating to `/code-review` is the right move.)

## Usage

```
/dual-review                  # Review the PR for the current branch
/dual-review 1234             # Review PR #1234
/dual-review --dry-run        # Build the report, show it, do NOT post
/dual-review --claude-only    # Skip Codex (discovery AND verification fall to Claude)
/dual-review --codex-only     # Codex discovers; Claude verifies
/dual-review --thorough       # No time caps, full verification, agent audit (the pre-2026-06 shape)
```

## Speed budget (default mode)

Target: **≤10 minutes wall-clock** for a large PR; a run that takes 45+ minutes has failed the user even if the report is good. The budget is enforced by construction, not by hoping:

| Phase | Budget | How it's enforced |
|---|---|---|
| Preflight + triage | ≤2 min | You, inline; no agents |
| Discovery (Claude + Codex, one wave) | ≤6 min | Sonnet partition reviewers; ONE Codex sweep wrapped in a 360s timeout (`perl -e 'alarm shift; exec @ARGV' 360` — macOS has no GNU `timeout`), low reasoning effort |
| Cross-verification | ≤4 min | Majors only; one batch each way; Codex batch wrapped in a 240s timeout (`perl -e 'alarm shift; exec @ARGV' 240`) |
| Synthesis + scripted audit | ≤3 min | You, inline; no audit agent |

Three rules that buy most of the speed:

1. **Every `codex exec` call is wrapped in a hard timeout** (360s discovery, 240s verification) — use the portable `perl -e 'alarm shift; exec @ARGV' <seconds>` wrapper, since stock macOS has no GNU `timeout` (it errors `command not found`, exit 127, and Codex silently never runs) — **and forced to cheap reasoning** (`-c model_reasoning_effort=low` — review sweeps don't need deep deliberation; the cross-model value is a *different model's* eyes, not a slow one's). A Codex call that hits its timeout is killed and the run proceeds without it, recording the timeout in the footer. Never sit waiting on an uncapped Codex process — observed wall times for uncapped calls run 10–26 minutes.
2. **No barrier waits between phases where the inputs are already in hand.** The moment the Claude panel returns, launch the Codex verification of Claude's major candidates — do not wait for Codex discovery to finish first just to dedupe. If a candidate later turns out found-by-both, the redundant verification was harmless; the saved serial wait is not.
3. **Verification is for majors/criticals only.** Single-model minors and nits go straight to the collapsed `<details>` section labelled with their finder (e.g. `[Claude only — unverified]`). Verifying a nit costs the same wall time as verifying a critical and changes nothing the reader does.

`--thorough` removes the timeouts and reasoning-effort cap, verifies every candidate, and restores the agent audit (Step 6). Offer it in your summary line when the default run had to drop a Codex call on the floor.

## The nine-angle checklist

Every discovery reviewer (both models) applies ALL of these to its assigned scope. They are a checklist within one prompt, not separate agents:

1. **line-by-line** — read every hunk, then the enclosing function (bugs in unchanged lines of a touched function are in scope). For every line: what input, state, timing, or platform makes it wrong? Inverted conditions, off-by-one, null deref, missing `await`, falsy-zero, copy-paste wrong variable, swallowed errors, unescaped regex. **Retry-semantics sub-check**: in retryable execution contexts (Airflow tasks, Celery/queue consumers, workflow activities, anything with `retries`/at-least-once delivery), trace what persistent state the code writes *before* it raises. If the raise's own trigger condition is derived by comparing against that state, the retry reads the just-written state and passes — the failure self-heals and the alert silently vanishes. Persist success-baselines only after (or conditional on) the check passing. (Evidence: a quarterly link-check DAG upserted the new ETag baseline per-sheet before raising on drift; with `retries: 1` the retry accepted any real change unnoticed. Found by a human reviewer, not the review pass.) **Identifier-precision sub-check**: when code queries an external source that accepts both a precise key already in hand (id/APN/SKU/parcel number) and a fuzzy one (name/address), using the fuzzy key invites ambiguous or multi-match responses the caller can't disambiguate (no picker), surfacing as a false "not found" / "multiple matches" state. Prefer the precise key; fall back to fuzzy only when it is genuinely absent. (Evidence: a parcel report searched DataTree by address while already holding the parcel's APN — condo/multi-parcel addresses returned `multiple_matches` + zero rows and showed a false empty state. Found by Codex on a Claude-only review pass, not the Claude angles.) **Absence-claim sub-check**: when a component branches on states (loading / error / empty / ready) and one arm renders a caveat (partial coverage, filtered subset, stale snapshot, permission-limited view), check every *other* arm whose copy makes a claim the same caveat qualifies — most sharply the zero-state, where "none found" silently becomes the false claim "none exist" under known-incomplete data. Enumerate the state × qualifier-flag combinations, not just the arms. (Evidence: a parcel report's `coveragePartial` disclosure lived only in its ready branch, so an empty DataTree response with `coverage_is_partial: true` — the service default — asserted "No recorded documents were found for this parcel" with no caveat. Found by a human reviewer, not the review pass.) **Threshold-inclusivity sub-check**: when the diff sets a bound (min/max zoom, clamp, page size, retry ceiling, rate limit, expiry) to the *same number* as a bound enforced elsewhere — especially inside a library — check the two comparisons' strictness (`>` vs `>=`) in the enforcing source rather than assuming inclusive. Mismatched strictness at equal values leaves a one-value dead band that exactly one user action reaches, where the feature silently stops working while surrounding UI still claims it. Read the library's own predicate; docs often say "min" and mean "strictly greater than". (Evidence: a report map set its view floor to 15, equal to its two tile layers' `minZoom`; OpenLayers requires `zoom > minZoom`, so one zoom-out click landed on the single zoom where both layers were invisible under a legend still claiming boundary + zoning. Found by a human reviewer, not the review pass.) **Effect-cleanup-symmetry sub-check**: when an effect mutates state that OUTLIVES it — a shared view/model object, `document.body`, a global store, a subscription's config, a parent's ref — every mutation needs an undo in the cleanup, not just the allocation. Tick the effect body's mutations off against its cleanup line by line; the recurring miss is removing what was *added* (a layer, a listener, a node) while leaving what was *set* (a bound, a class, a flag), because the added thing is visibly owned and the set thing looks like configuration. Sharpest when the mutated bound carries a documented invariant, since the next consumer then inherits a state that invariant says is impossible. (Evidence: a report map's Environmental effect relaxed the view's `minZoom` below the tile floor so the widest screening ring could be framed; the cleanup removed the ring layer but left the floor, so Overview and Zoning inherited a map zoomed past where their own layers render with the legend still listing them — reintroducing, by another route, exactly what the threshold sub-check above exists to prevent. Found by a human reviewer.)
2. **removed-behavior** — for every deleted/replaced line, name the invariant it enforced and find where the new code re-establishes it. Removed guards, dropped error paths, narrowed validation, deleted tests.
3. **cross-file** — for each changed function/component, check callers and callees for broken contracts (new precondition, changed return shape, new exception, ordering). Grep tests/snapshots for assertions on changed literals. **Wire-shape sub-check**: when the diff adds or changes a field on a serialised model (API response/request, event payload, message schema), verify the *actual serialised output* against the stated contract (ticket AC, PR description, what consumers key on) — null vs omitted key, optional vs required, defaults injected by *unchanged* framework machinery (e.g. FastAPI's `response_model` serialises a `None` default as an explicit `"field": null`; an endpoint decorator the diff never touched decides the wire format). Object-level assertions (`x.field is None`) prove nothing about the wire — demand a test at the serialised boundary, and flag its absence as a finding. (Evidence: a new optional `eightyAcreSheet` field passed a full dual review — both models, cross-verified — while emitting `null` on every parcel, breaking the "key presence = coverage" contract; every test in the PR *and in the review's own additions* asserted at the object level, so the suite reinforced the miss. A human consumer-side reviewer caught it.) **Eligibility-parity sub-check**: when the diff issues a request to an external resource (tile layer, API, image, proxy) whose availability is gated ELSEWHERE by an eligibility/feature check (flag + region + preconditions), verify this call reuses the SAME gate. An ungated request 4xxs in the excluded contexts, and any UI it drives (legend, count, "present"/"covered" state) then asserts data that isn't there. (Evidence: a parcel-report map always added the Zoneomics tile layer + a "zoning district" legend even where `useZoneomicsEligibility` hid zoning everywhere else — failing tile requests plus a legend claiming coverage. Found by Codex on a Claude-only pass.) **Confidence-qualifier sub-check**: when the diff consumes an external/backend response, enumerate its *non-data* fields (`resolved`, `coverage_is_partial`, `approximate`, `score`, `is_estimate`, `stale_at`, `truncated`) and confirm the consumer reads every one that qualifies how far the payload can be trusted — dropping one promotes a fuzzy match to a confirmed fact, and is worst where the UI hangs an irreversible or paid action off each row. Cheapest detection: grep the endpoint's *other* consumers for the field; a sibling surface that warns where this one doesn't is the finding. (Evidence: a parcel report rendered DataTree records with a Buy button while ignoring `resolved: false` — the backend's flag for its plain-address text-match fallback, whose rows the chat card explicitly narrates as "may include nearby addresses" — so a user could pay for a neighbour's deed. Found by a human reviewer, not the review pass.) **Stated-parameter sub-check**: when the UI draws, labels, or narrates a *query parameter* the response does not carry (search radius, time window, sample size, score cut-off, cohort), trace it to the producer's actual constant instead of accepting the client's hard-coded value or a comment asserting "the convention is X". Producers routinely use tiered, per-type, or configurable values — a single client-side number then gives the visual a false meaning: legitimate results fall outside the drawn boundary while other queries stop well inside it. Either mirror the producer's values (with a test pinning them so drift is caught) or relabel the element as a reference distance rather than the boundary. (Evidence: a parcel report's mini-map drew one 500 m ring as "the EPA summary's search radius" while the backend screened at tiered ASTM distances — 0.5 mi SEMS, 0.25 mi RCRA/ACRES, 0.125 mi the rest, so SEMS hits legitimately sat outside the ring. Found by a human reviewer, not the review pass.) **Boundary-label-vs-contents sub-check**: the follow-on to the above — once results are grouped into buckets derived from a query parameter (tiers, radii, time windows, price/score bands, cohorts), a bucket heading may state its *boundary* but must not attribute the boundary's qualifier to the items inside it. Ask it of the NARROWEST bucket: can an item belonging to a different stratum land here? Under tiered querying every stratum reaches the innermost bucket, so any qualifier in its heading is wrong for most of its contents. Boundaries describe the query; buckets hold the answer. Note also that a green suite is no evidence here — the author's fixture encodes the same misreading as the copy, so check the label against the data that can actually reach it, not against the chosen fixture. (Evidence: after the fix above split one ring into three ASTM tiers, the panel headed the matching distance bands with each tier's programme — "Within 0.125 mi · Other federal programmes" over a hazardous-waste site, and a middle band naming hazardous waste while legitimately holding Superfund. The PR's own test asserted the contradictory heading. Found by a human reviewer.)
4. **security** — injection, authn/authz gaps, secrets, PII exposure, unsafe deserialisation, data-loss/migration hazards, tenant isolation.
5. **reuse** — new code re-implementing an existing helper (name it); the diff fixing some copies of duplicated code while leaving siblings divergent. **Sibling-completeness sub-check**: when you find a bug, or the diff adds a guard/fix, in one of several near-identical siblings — two maps, two panels, two hooks built from the same template — grep for the twins and confirm each got the same treatment; a fix applied to one instance and missed on its clone is a common recurrence. (Evidence: a no-coordinates guard was added to a parcel report's environmental *mini*-map but its twin, the persistent map column built from the same pattern, still initialised on Null Island `[0,0]`. Found by Codex on a Claude-only pass.)
6. **simplification** — redundant/derivable state, copy-paste variation, deep nesting, dead code, contradictory patterns side by side.
7. **efficiency** — redundant computation/I/O, sequential independent ops, blocking work on hot paths, closure-built long-lived objects pinning scopes. **Eager-governed-side-effect sub-check**: a hook/effect that fires a paid external lookup or emits a governed analytics/billing event on mount/open — before, or regardless of whether, the user reaches the surface that consumes it — both wastes the paid call and over-reports the governed metric on every open. If the call/event represents engagement with one specific view, gate its *enablement* on that view being active (lazy-on-entry) while keeping the result cached so re-entry doesn't refetch; leave genuinely landing-view data eager. This outranks a normal cleanup finding — it corrupts a governed metric, not just wastes cycles. (Evidence: a parcel report's DataTree documents query ran on report open while the user stayed on Overview, emitting `RE Data Source Served` for opens that never showed a document. Found by Codex on a Claude-only pass.) **Cache-policy-pair sub-check**: retention and freshness are separate knobs, and a diff that sets one to deliver a "no repeated work" guarantee almost always needs the other too. Retention (`gcTime`, TTL, keep-alive) decides whether the entry still exists; freshness (`staleTime`, revalidate, `max-age`) decides whether it is served without a refetch. Retention alone produces the worst shape: the surface renders instantly from cache and fires the paid call behind it, so the cost is real but invisible both in the UI and in any test asserting the synchronous state — demand an assertion on the call count after remount, not on the rendered state. Cheapest detection: grep the codebase's other paid query of the same kind; a sibling already setting both, with the rationale in a comment, is the answer. (Evidence: an EPA summary got `gcTime: Infinity` so a report reopen wouldn't refetch, but the untouched five-minute `staleTime` meant a reopen minutes later served cache *and* refetched anyway; the query beside it had `staleTime: Infinity` with the reason written out. The PR's new reopen test asserted only that the state was synchronously `ready`. Found by a human reviewer.)
8. **altitude** — is each change at the right depth? Special cases on shared infrastructure, global knobs widened to absorb a local problem, undisclosed scope creep vs the PR description, hand-edits where a lint rule would fix-and-prevent.
9. **devils-advocate** — challenge the premise: hidden assumptions, simpler alternatives, what breaks at 10× or under partial failure. (Reported as challenges, not findings.) **Whole-PR reviewers only** — partition reviewers skip this angle: premise challenges live at the PR level, and per-chunk devil's advocacy produces noise. Track record justifies keeping it at that level: it has repeatedly produced the review items that became follow-up work (metric-semantics challenges, missing gating, product-placement questions).

For angles 5–8, findings state the concrete cost (duplicated, wasted, harder to maintain) instead of a crash. Correctness findings outrank cleanup findings.

### Learning from misses (keep this skill honest)

When a defect surfaces in a PR this skill reviewed — found later by a human reviewer, another tool, or production — treat it as a defect in *this checklist*, not just in the PR:

1. **Preflight recall (Step 1)**: while reading the PR, also pull existing review comments from humans/other bots (`gh api repos/<owner>/<repo>/pulls/<num>/comments`). Anything already found that the funnel would plausibly have missed is calibration data — and any *unaddressed* human finding belongs in the report's context so the summary never contradicts or ignores it.
2. **Post-mortem the miss**: name the angle that *should* have caught it and why it didn't (wrong boundary, unchanged-code interaction, contract lived outside the code, test suite reinforced the illusion).
3. **Fold it back in**: add a one-sentence sub-check to the relevant angle with a compressed war story as evidence, exactly like the wire-shape and retry-semantics sub-checks above. Sub-checks earn their prompt space by being generalisable patterns, not one-off anecdotes — if the miss doesn't generalise, skip the edit.
4. **Review the fixes this skill asked for.** A fix written to close a review finding is unreviewed code — authored quickly, and under the comfortable assumption that a reviewer already reasoned the change through. It has not been: the reviewer reasoned about the *defect*, not about the patch. Before a re-review declares findings closed, run at least the line-by-line and cross-file angles over the fix commit itself, hardest where the fix mutates shared state, rewrites user-facing copy, or sets the specific knob a finding named. Where a fix is meant to make a claim true, check the assertion pinning it actually fails without the fix — a test written alongside a patch tends to encode the patch's own assumptions. (Evidence: on one PR, two of the three defects a human reviewer later found were introduced by fixes this skill recommended — a view-floor relaxation with no restore, and per-programme labels attached to distance buckets after a ring-tiering fix — and both shipped with new green tests that asserted the wrong thing.)

## Step 1 — Preflight

1. Resolve the PR (`gh pr view --json number,title,body,baseRefName,headRefName,headRefOid,url`). No PR → stop and tell the user.
2. Check `command -v codex`. If missing and `--codex-only` was not requested, warn and continue with Claude doing both discovery and verification (note in the report).
3. `OUT_DIR=$(mktemp -d /tmp/dual-review-XXXXXX)`; save `gh pr diff <num> > "$OUT_DIR/pr.diff"` and `--name-only > "$OUT_DIR/files.txt"`.
4. If local HEAD ≠ the PR's `headRefOid`, note it (diff file is the source of truth; local files are context only) — tell reviewers and footer.
5. Staleness check: fetch the base branch and spot-check whether files the diff touches have since changed on the base. Colliding hunks on a stale branch are themselves a finding — prime the relevant partition reviewers.

## Step 2 — Triage and partition

Read `files.txt` and skim the diff yourself (or via one quick agent for very large diffs). Produce:

- **Partitions**: 2–6 coherent groups of changed files (by subsystem/directory/concern — e.g. "backend API + tests", "frontend feature X", "CI/test infra"). Every changed file lands in exactly one partition. Merge trivial partitions; a partition should be reviewable with full attention in one sitting (~≤1,500 diff lines).
- **Risk ranking**: which partitions are highest-risk (state mutation, auth, money, migrations, concurrency, deleted code) vs mechanical (renames, generated files, lockfiles).
- **Checklist pruning per partition**: note angles that are obviously inapplicable (e.g. no security surface in a CSS-only partition) so reviewers spend attention where it pays. Never prune line-by-line or removed-behavior.
- Save the triage map to `$OUT_DIR/triage.md` — discovery prompts reference it.

**Size tiers** — pick the shape from the diff size, then apply the risk override below:

- **Tiny (< ~250 lines, or purely mechanical diffs — class renames, lockfiles, generated files — even above that)**: skip Codex entirely. Delegate the review to the built-in `/code-review` skill at low/medium effort — with no cross-model verification to feed, its capped-JSON output is no longer a problem, and its tuned finder/verify pipeline beats maintaining a parallel single-model prompt here. (Evidence: a 220-line class-rename PR ran the dual shape — Codex's one finding duplicated Claude's, its devil's-advocate bullets matched almost one-for-one, and its verification call hung for 26+ minutes. All cost, no marginal recall.)
- **Medium (~250–400 lines)**: ONE partition, reduced shape — one Claude discovery reviewer + one Codex discovery reviewer (same checklist), then cross-verify.
- **Large (> ~400 lines)**: the full partitioned funnel described above.

**Risk override**: line count is a poor proxy for risk. If the diff carries any of the risk markers from the ranking above (state mutation, auth, money, migrations, concurrency, significant deleted code), force the dual-model shape — medium at minimum, full funnel if warranted — regardless of size. A 100-line migration deserves the full treatment.

Note the chosen shape (and any override) in the footer.

**Re-check `headRefOid` before synthesis (Step 5), not only at preflight.** An author actively working the PR will force-push *during* the run — a review takes minutes and a rebase takes seconds. Re-run `gh pr view <num> --json headRefOid` for every PR under review; if a SHA moved, re-pull the diff, re-task the reviewers whose files changed, and re-run the affected Codex sweep before synthesising. Findings verified against a stale diff are worse than no findings: they re-report defects the author already fixed, which reads as inattention and buries the real ones. State the head SHA each summary was written against in its footer, and say explicitly when an earlier pass was discarded. (Evidence: on a four-PR stack, two PRs force-pushed mid-review — one dropped a whole file from its scope and the other replaced its dedup mechanism outright. A partition reviewer noticed independently and warned the lead; without that, roughly half the report would have described code that no longer existed.)

## Step 3 — Discovery (launch everything in ONE message)

Write each prompt to `$OUT_DIR/prompt-<name>.txt` first (avoids quoting issues; Codex and Claude get identical prompt text — there is nothing model-specific in them).

**Claude panel** (Agent tool, `subagent_type: general-purpose`, all in parallel):
- **One reviewer per partition** — angles 1–8 applied to that partition's files only (it may Read surrounding code for context, but its findings scope is the partition). Include the triage map and any staleness notes. **Default mode: pass `model: sonnet`** — scoped partition review is exactly the shape a fast model handles well, and the partition reviewers are the long pole of the Claude wave (observed 4–7 min on the default model). Cap partitions at 3 in default mode (merge the lowest-risk ones); `--thorough` allows up to 6 and the default model.
- **One whole-diff integration reviewer** (default model — it carries angle 9 and the seams, where depth pays) — reads the triage map and the full diff at skim level; hunts ONLY for cross-partition interactions (angle 3 at the seams) and the devil's-advocate case (angle 9) against the PR as a whole. This is the one reviewer the partitioning would otherwise blind.

**Codex panel** (Bash `run_in_background: true`, from the repo root):

```bash
# `timeout` is GNU coreutils and is NOT on stock macOS — `timeout 360 ...` fails with
# "command not found: timeout" (exit 127) and Codex never runs. Use the portable
# perl-alarm wrapper below (works on macOS and Linux). `gtimeout` from Homebrew
# coreutils also works if installed, but perl is always present — prefer it.
perl -e 'alarm shift; exec @ARGV' 360 codex exec -s read-only --ephemeral -c model_reasoning_effort=low \
  -o "$OUT_DIR/codex-sweep.md" "$(cat "$OUT_DIR/prompt-codex-sweep.txt")" < /dev/null
```

The `< /dev/null` is load-bearing: `codex exec` sometimes decides to read additional input from stdin and hangs indefinitely waiting for it. The `perl -e 'alarm shift; exec @ARGV' 360` timeout and `model_reasoning_effort=low` are equally load-bearing for the speed budget — see the Speed budget section. (The `alarm`'s SIGALRM survives the `exec` and default-terminates Codex at the cap, so it behaves like `timeout` without needing it installed.)

- **Default mode: ONE sweep** — all angles 1–9, scoped to the top-risk partition(s) at full depth plus the rest of the diff at skim level (say exactly that in the prompt). Cross-model recall comes from a different model reading the same risky code, not from Codex reading everything twice.
- **`--thorough`: two sweeps** — one correctness sweep (angles 1–4) over the top-risk partition(s); one cleanup + devil's-advocate sweep (angles 5–9) over the whole diff at skim level. No timeout, default reasoning effort.

Write your prompt files with the Write tool, not shell heredocs assembled from `sed`/`grep` — observed failure: a heredoc built from `grep -A` produced duplicated and truncated candidates that had to be rewritten anyway.

Discovery prompt rules (include verbatim): findings as `**[critical|major|minor|nit] path:line — title**` + impact paragraph + suggested fix + confidence; only issues introduced or made worse by this diff; surface every candidate with a nameable failure scenario or concrete cost — do NOT self-censor half-believed candidates, the verification stage does the filtering; "No findings" is a valid report; output raw markdown, no preamble.

If a Codex job fails or hits its `timeout`, proceed without it and record the failure in the footer.

## Step 4 — Cross-model verification

**Default mode — verify majors/criticals only, launch eagerly.** As soon as the Claude panel returns, write up its critical/major candidates and launch the Codex verification batch (`perl -e 'alarm shift; exec @ARGV' 240`, `model_reasoning_effort=low`) immediately — in parallel with any still-running Codex discovery. When Codex discovery lands, dedupe its candidates against Claude's (found-by-both → cross-validated, no verification needed — a redundant in-flight verification is harmless) and send its unmatched majors to one Claude verifier agent. Single-model minors and nits skip verification entirely and are reported in the collapsed section tagged `[<finder> only — unverified]`. If the Codex verification batch times out, report Claude's majors as **Surviving** (tagged `unverified — Codex timeout`) rather than waiting — never block the report on a hung verifier.

**`--thorough` — verify every candidate** with the model that did NOT find it (Claude finding → Codex verifier; Codex finding → Claude verifier; found by both → already cross-validated, skip verification).

In both modes: dedupe first (same file/region + same root cause → one candidate, keep the clearer write-up, remember which model(s) found it). Verifiers get a focused prompt: the candidate, the relevant diff hunks, and instructions to actively try to REFUTE it. Batch several candidates into one verifier call per model to keep the call count low (one Codex call and/or one Claude agent usually suffices; split into 2–3 batches only if there are many candidates). Verdict per candidate:

- **CONFIRMED / PLAUSIBLE** — keep. Be recall-biased: realistic-state findings (races, rare-but-reachable paths, falsy-zero, boundary off-by-ones) are PLAUSIBLE, not refuted-for-being-speculative.
- **REFUTED** — only when constructible from the code: factually wrong (quote the line), provably impossible (show the type/invariant), already handled in the diff (cite the guard), or pure style with no observable effect. Drop these.

Devil's-advocate challenges skip verification — they are questions for the author, not defects.

## Step 5 — Synthesise: full report (local) + concise summary (posted)

Build both yourself — do not delegate synthesis. Order correctness/security before altitude before reuse/simplification/efficiency. Confidence tiers:

- **Cross-validated** — found by both models, or found by one and CONFIRMED by the other's verifier → lead section.
- **Surviving** — found by one model, PLAUSIBLE (not confirmed, not refuted) under the other's verification → "worth verifying" section.
- Nits and low-confidence survivors → collapsed `<details>` (full report only).

Produce **two artifacts**:

1. **Full report → `$OUT_DIR/report.md` — kept locally, NEVER posted to the PR.** The complete record (impact paragraphs, devil's-advocate, nits) for whoever ran the review; printed on `--dry-run`, its path surfaced at the end.
2. **Concise summary → `$OUT_DIR/summary.md` — the ONLY thing posted.** Every actionable finding compressed to a single line — **`path:line` + problem + fix** — so an agent can read the comment and go straight to fixing, with no full report in the PR thread. Drop impact paragraphs, devil's-advocate (those are questions, not fixes), and nits — they live only in `report.md`.

**Full report (`report.md`, local only):**

```markdown
## 🔍 Dual Review — Claude × Codex (full report — local, not posted)

**Verdict:** <one sentence: merge-ready / needs changes / needs discussion, and why>

### ✅ Cross-validated findings (high confidence)
<findings tagged with finder → verifier, e.g. `[Claude → Codex ✓]`, or "None.">

### 🔶 Surviving findings (worth verifying)
<findings, or "None.">

### 🧹 Cleanup (reuse / simplification / efficiency / altitude)
<cleanup findings, cross-validated first, or "None.">

### 😈 Devil's advocate
<merged challenge list>

<details><summary>Nits & low-confidence findings</summary>
...
</details>
```

**Concise summary (`summary.md`, posted as the sticky comment):**

```markdown
<!-- dual-review-sticky -->
## 🔍 Dual Review — Claude × Codex

**Verdict:** <one sentence: merge-ready / needs changes / needs discussion, and why>

<one-line counts, e.g. "2 to fix · 1 worth verifying · 3 cleanup. Full report kept locally, not posted.">

### 🔴 Fix
- **[critical] path:line** — <problem in one line>. **Fix:** <concrete action an agent can apply>. `[Claude → Codex ✓]`

### 🟠 Worth verifying
- **[major] path:line** — <problem>. **Fix:** <action>. `[Codex only · Claude: PLAUSIBLE]`

### 🧹 Cleanup
- **[minor] path:line** — <what it costs>. **Fix:** <action>.

---
*Concise summary from `/dual-review` at <UTC timestamp> against <head sha (7)>. Full report (impact analysis, devil's-advocate, nits) kept locally and not posted. Shape: <N> partitions, Claude (<N+1> discovery), Codex (<1 sweep | 2 sweeps>), cross-model verification (<majors only | all candidates>). <Failures/warnings: Codex timeouts, stale local HEAD, reduced small-diff shape, unverified-tier candidates.>*
```

Rules for the posted `summary.md`:

- **Every finding is one line carrying a concrete `path:line` and a `**Fix:**`** — an agent must be able to act on it without the full report. A candidate with no nameable fix is not actionable enough to post; leave it in `report.md`.
- **Omit empty sections** rather than writing "None." — keep it tight. With zero actionable findings, post the verdict line plus "No actionable findings — see the local report for nits/challenges."
- The `<!-- dual-review-sticky -->` marker must be the **first line of `summary.md`** — re-runs find the comment by it. The marker lives on the summary (the only posted artifact), never on `report.md`.
- On the tiny-diff fallback path, the summary footer must say so explicitly — e.g. `Shape: single-model fallback (/code-review, diff under threshold) — no cross-model validation` — so the sticky comment never implies dual-model confidence it doesn't have. List `/code-review`'s findings under "🔴 Fix" without cross-validation tags.

## Step 6 — Sanity-check the report before posting

`summary.md` is the outward-facing artifact — the team reads it on GitHub — so audit it before it leaves. Write `$OUT_DIR/report.md` (full, local) and `$OUT_DIR/summary.md` (concise, posted), then audit **`summary.md`**:

**Default mode — audit it yourself, scripted + inline (no agent).** Run the mechanical checks as shell one-liners against `summary.md`: the sticky marker is line 1 (`head -1 summary.md`), no template slots remain (`grep -nE '<N>|<UTC timestamp>|<head sha|path:line'`), every posted finding carries a fix (`grep -c '\*\*Fix:\*\*' summary.md` ≥ the finding count), and every `path:line` it cites appears in `files.txt` (`grep -oE '[a-zA-Z0-9_/.-]+\.(py|ts|tsx):[0-9]+' summary.md` cross-checked against `files.txt`). Confirm `report.md` exists locally but is **not** what you post. Then re-read the summary once against your own candidate list for the judgment checks (tier-vs-verdict consistency, refuted findings leaked in, verdict-vs-body contradiction). You wrote the synthesis seconds ago with the verification verdicts in context — a fresh agent re-deriving all of that costs 3+ minutes to mostly confirm what you already know. The agent audit earns its time only when the synthesis context is NOT trustworthy: `--thorough` mode, a report assembled across a compaction boundary, or >15 findings.

**`--thorough` — run one focused auditor** (Claude Agent; give it `report.md`, `summary.md`, `pr.diff`, and `triage.md`) that checks:

1. **Every `file:line` claim resolves against the diff** — the file is in `files.txt` and the quoted code/claim matches the hunk. Hallucinated locations are the most common synthesis defect.
2. **Nothing REFUTED leaked in**, and every finding's tier matches its verification outcome (cross-validated vs surviving).
3. **The verdict sentence is consistent with the body** — "needs changes" with no findings, or "merge-ready" above a critical, is a contradiction.
4. **No internal contradictions or surviving duplicates** between sections.
5. **Mechanical integrity** — markdown renders (balanced `<details>`, fenced blocks closed), no placeholder text (timestamps, `<N>` slots) remains.
6. **The posted `summary.md` is self-sufficient and concise** — `<!-- dual-review-sticky -->` is its literal first line, every finding has a `path:line` and a concrete `**Fix:**`, and no full-report-only content (impact paragraphs, devil's-advocate, nits) leaked in. The full `report.md` is the place for that detail; the summary is not.

The auditor returns either `PASS` or a list of defects with corrections. Apply corrections yourself and re-check only what changed. If the auditor flags a finding's substance as unsupported by the diff, demote it to the nits block or drop it — do not post claims the diff doesn't back.

## Step 7 — Post (sticky)

**Post `summary.md` only — never `report.md`.** If `--dry-run`, print the audited `summary.md` (and note the local `report.md` path) and stop. Otherwise:

```bash
REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
CID=$(gh api "repos/$REPO/issues/<num>/comments" --paginate \
      --jq '.[] | select(.body | startswith("<!-- dual-review-sticky -->")) | .id' | head -1)
if [ -n "$CID" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$CID" -F body=@"$OUT_DIR/summary.md"
else
  gh pr comment <num> --body-file "$OUT_DIR/summary.md"
fi
```

Finish with the comment URL, a two-line verdict/finding-count summary, and the `$OUT_DIR` path — where the **full `report.md`** (not posted) and raw panel outputs live for anyone who wants the detail.
