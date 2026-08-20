---
name: vibe-code
description: Orchestrate a change end-to-end — open a Linear ticket, implement it via Codex sub-agents, ship a PR through the standard ritual (/zombies tests-first, /simplify before opening, WARM-check on new dependencies, /visual-recap in the description, /triage as a comment), optionally run /dual-review when the user asked for reviews, then hand off to /ship-pr to babysit CI and land it. Use when the user wants a change taken all the way to merged with the implement-review-land loop handled for them.
disable-model-invocation: true
argument-hint: "<what to ship — a feature, fix, or change>"
allowed-tools: "Bash, Read, Edit, Write, Grep, Glob, Agent, Skill, AskUserQuestion"
---

# Vibe Code

Take a change from idea to merged. **You are mostly an orchestrator**: you decide, sequence, and delegate — Codex sub-agents do the implementation, the repo's skills do the ritual steps, and `/ship-pr` babysits the landing. Your job is to keep the whole thing moving, verify every delegated result against the actual diff, and make sure every piece of feedback is genuinely addressed (not just acknowledged).

## Operating principles

- **Delegate the work, own the decisions.** Spawn sub-agents for implementation, simplification, and review. You read their output, decide what to act on, and keep the thread coherent.
- **Codex is the default implementation engine.** This is a deliberate experiment: implementation briefs go to `codex exec` first (mechanics below), with Claude sub-agents as the recorded fallback. Keep a scorecard as you go — the final report must make the experiment readable (see Done).
- **Sub-agent briefs are self-contained.** Sub-agents don't inherit your context, skill triggers, or the user's conventions — paste the relevant plan, file paths, test cases, acceptance criteria, and any convention the agent needs directly into the prompt.
- **Verify, don't trust.** A sub-agent's "done" message is not evidence. After every delegated slice, read `git diff` yourself and run the repo's own checks (its `just check` / test / lint entry points) before building on the result.
- **Fan out when independent.** Run independent sub-agents in parallel; sequence only true dependencies (implement → simplify → review).
- **Use the highest practical reasoning effort** for implementation and review briefs. Don't silently downgrade for mechanical work; narrow the brief's scope instead.

## Phase 1 — Linear ticket

Before writing code, anchor the work to a Linear ticket.

1. If the user gave a ticket, use it. Otherwise create one — **ask which Linear team/project it belongs in** if ambiguous (`AskUserQuestion`, most likely options first).
2. Give it a clear title and a short description of the intended change; link any originating thread, alert, or issue.
3. Keep the ticket id — it goes in the PR description's `Linear:` line, **never** in the PR title.

## Phase 2 — Implement via Codex sub-agents

1. **Isolate.** Create the branch/worktree named `<type>-<ticket>-<short-desc>` (e.g. `fix-ABC-123-…`) and verify with `git rev-parse --show-toplevel`. Never work on `main` or in the primary checkout. Follow the target repo's own worktree conventions if it documents any (AGENTS.md / CLAUDE.md).
2. **Enumerate tests first.** Run `/zombies` on the planned change to enumerate the cases worth testing (Zero, One, Many, Boundaries, Interface, Exceptions, Simple). The surviving cases go verbatim into the implementation brief: tests are written first and drive the implementation, matching the repo's existing test patterns.
3. **Delegate to Codex.** Write the brief to a file with the Write tool (never shell heredocs assembled from `sed`/`grep` — observed to produce truncated prompts), then:

   ```bash
   perl -e 'alarm shift; exec @ARGV' 1200 codex exec -s workspace-write --ephemeral \
     -C "$WORKTREE" -c model_reasoning_effort=high \
     -o "$OUT_DIR/codex-implement.md" "$(cat "$OUT_DIR/prompt-implement.txt")" < /dev/null
   ```

   Flags verified against codex-cli 0.148: `-s workspace-write` (write access inside the worktree), `-C` sets the working root, `--ephemeral` skips session persistence, `-o` writes the agent's last message to a file.

   Three pieces of load-bearing lore, learned the hard way in `dual-review`:
   - **The perl-alarm wrapper is the timeout.** Stock macOS has no GNU `timeout` (`command not found`, exit 127, Codex silently never runs); the `alarm` survives the `exec` and terminates Codex at the cap. Never sit on an uncapped Codex process — uncapped calls have been observed running 10–26 minutes. 1200s is the implementation default (implementation legitimately runs longer than a review sweep); if a call hits the cap, narrow the brief and retry once.
   - **Run it in the background, or the alarm is not the timeout.** The Bash tool caps a foreground call at 600s and silently clamps a larger `timeout` argument to it, so a 1200s alarm never fires — the harness kills Codex at 10 minutes and reports a timeout the brief did not cause. Observed: a correctly-sized implementation brief killed mid-run with the alarm still pending. Launch Codex with `run_in_background: true` and read the output file when the completion notification arrives; then the perl alarm is the only cap, as the bullet above intends. The same clamp applies to every long call in this skill — `just check`, full test suites, CI waits.
   - **`< /dev/null` is load-bearing** — `codex exec` sometimes decides to read additional input from stdin and hangs indefinitely waiting for it.
   - **The output file is not the work.** After each call, ignore the prose and read `git -C "$WORKTREE" status` + `git diff` — that diff, plus the repo's checks passing, is the only acceptance evidence.
4. **Fallback to Claude, on the record.** If `codex` is not installed, a call times out twice on an already-narrowed brief, or a slice needs a second full redo, reassign that slice to a Claude sub-agent (Agent tool) with the same brief. Record every fallback and its trigger in the scorecard — a silent fallback makes the experiment unreadable.
5. **Commit intentionally.** `git add -p`, never `-A`; let pre-commit hooks run; never skip them. If a slice adds or upgrades a dependency, run `/warm` on it **before** committing that manifest change — a new dependency never lands uncommented.

## Phase 3 — The PR ritual

These are standing steps, in this order — not optional, not diff-size-dependent:

1. **`/simplify` on the branch before opening the PR.** Apply what it finds, or record why a finding was skipped. If `/simplify` isn't available in the host, spawn a simplifier sub-agent over the changed code instead. Quality-only; it does not replace review.
2. **Confirm every dependency the branch adds or upgrades was WARM-checked** (Phase 2 gates each manifest commit on `/warm`; run it now on anything that slipped through). Report the verdicts; never land a new dependency without flagging its WARM result to the user.
3. **Open the PR ready-for-review** (not draft — PRs open ready once self-validated).
   - **Title**: pure `type(scope): summary` (Conventional Commits with a scope). No ticket prefix.
   - **Description**: what changed and why, the `Linear:` line with the ticket, and links to every referenced artefact (originating issue, failing run, related PRs).
4. **`/visual-recap` in recap mode**, upserting its block into the PR description. Part of writing the description, not a separate comment; re-run it after pushing significant new commits.
5. **`/triage` on the PR's diff**, posted as a PR comment. If a triage comment already exists on the PR, update it — never add a duplicate.
6. **Keep the surface current.** As the diff drifts under feedback, re-check that title, description, and recap still describe what actually shipped.

## Phase 4 — Review panel (only if the user asked for reviews)

**Skip this phase unless the user explicitly asked for reviews** (in the invocation or during the run). Don't ask whether to run it; absence of a request means skip — CI and the inbound automated reviewers in Phase 5 remain the review signal.

When asked: run `/dual-review` on the PR — the Claude panel + Codex sweep with adversarial cross-verification. Act on what survives your judgement *before* Phase 5: delegate fixes as Phase 2 briefs, re-run `/simplify` if the diff has grown, and carry anything raised-but-declined (with rationale) into the Phase 5 handover so it isn't re-litigated from scratch.

## Phase 5 — Hand off to `/ship-pr` to babysit and land

**Do not hand-roll the CI-and-land loop — invoke `/ship-pr` and let it own it**: readiness, CI loops, fixing failures, AI-reviewer feedback, mergeability, the optional merge, and the closing Slack summary.

1. **Invoke `/ship-pr`** with the PR number/URL. The PR is already open and ready — it must not create a branch or open a second PR.
2. **Hand over context in the same breath**: what the change is, the Linear ticket, and — if the Phase 4 panel ran — what it raised, taken and declined, with rationale for each declined item.
3. **Route review feedback through `/address-review`.** If human or bot review comments accumulate, that skill owns the harvest → investigate → fix/refute → reply-and-resolve loop; feed its fix commits back through the Phase 3 surface checks.
4. **Stay the owner.** The skills do the polling and the loops; you make the calls they escalate — scope/design trade-offs, undiagnosable failures, anything needing the user. Don't duplicate their work by polling the PR yourself in parallel.
5. **If a fix materially changes the diff** and the user asked for reviews, loop back through Phase 4 before landing.

## Done

Report to the user:

- The ticket, the PR link, and confirmation the PR **merged** (or exactly what's blocking, if you stopped short).
- What each ritual step and review surfaced and how it was resolved (including WARM verdicts and skipped /simplify findings).
- **The Codex scorecard**: per delegated slice — brief scope, wall time, timeouts/retries, whether the diff was accepted as-is / patched / redone, and every fallback to Claude with its trigger. This is the data the experiment exists to produce.

## Notes

- Never force-push a PR under review — it orphans review-thread anchors.
- Never skip pre-commit hooks; tests run on commit-time hooks or CI.
- If you're blocked on a decision only the user can make (which Linear team, a real scope/design trade-off), ask — one question at a time, with a recommendation. Otherwise make the reasonable call and keep going.

## Provenance

Adapted from a privately shared `vibe-code` orchestration skill (unpublished; no canonical upstream URL). Changes in this version: the `/merge` hand-off becomes `/ship-pr` and review feedback routes through `/address-review` (both in this repo); the bespoke review panel becomes `/dual-review`; the PR ritual is replaced with the standing personal workflow (/zombies tests-first, /simplify pre-PR, WARM dependency check, /visual-recap upsert, /triage comment); implementation is delegated to Codex CLI sub-agents with the invocation mechanics proven in this repo's `dual-review` (perl-alarm timeout, stdin guard, output-file discipline), plus an explicit fallback-and-scorecard protocol; source-repo-specific conventions (comment sign-offs, ticket prefixes, hardcoded model names) are stripped or generalised.
