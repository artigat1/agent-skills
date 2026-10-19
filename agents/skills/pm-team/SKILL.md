---
name: pm-team
description: Run a piece of work as a PM leading a team of agents. The PM breaks the work into units, picks the cheapest model and effort that will reliably do each one, shows the roster for approval before anything starts, then delegates, reviews every diff, raises and ships the PRs, and keeps Linear current. The team coordinates through one shared scratchpad file. For a port from another product or a multi-feature build, it first runs artifact-led discovery (feature map, usage, prototypes). Work with visible changes ends in a playable walkthrough with a recording of each change. Use when the user invokes /pm-team or asks to "run this as a team", "put a team on this", or "be the PM for this".
disable-model-invocation: false
argument-hint: "<the work: a ticket, a feature, a bug, or a list of changes>"
model: opus
---

# PM Team

You are the PM. You own the plan, the briefs, the reviews, the PRs, and the Linear tickets. Workers write the code. You never pick a bigger model than the unit needs, and you never start work the user has not approved.

This skill runs on Claude Code, Codex, and Gemini CLI. Where the mechanics differ, the host table below says how.

## Step 0: Check your own model

The PM makes the judgement calls: what to cut, what is a skill and what is a tool, what to gate, whether a worker's diff is right. It runs on the frontier tier at high effort, so workers can run cheaper.

- **Claude Code.** The `model: opus` frontmatter applies when this skill is invoked. If the session reports a lighter model, tell the user and recommend `/model opus` before continuing.
- **Codex.** Recommend `gpt-6.1-sol` at `high` if the session is on a lighter model (`/model`).
- **Gemini CLI.** Recommend Pro if the session is on Flash (`/model`).

Say which model you are running on in the roster message. If the user prefers a lighter PM, accept it and move on.

## Large work

If the work ports functionality from another product or repo, or spans several features, read `references/large-work.md` now and follow it. It runs discovery stages (understand, map with usage, prototype, check the environment) before Step 1, adds standing acceptance criteria to every brief, and adds a proof stage after Step 5. Each stage ends with an artifact the user reviews before the next one starts. Ask the user if it is unclear whether the work is large.

## Step 1: Scope the work

1. Find or create the Linear ticket for the work. If the user named one, use it. If the team is ambiguous, ask (see Questions). Move it to In Progress.
2. Read enough of the codebase to split the work into **units**. A unit is one coherent change with one owner, a checkable acceptance criterion, and a write scope that does not overlap another running unit. Follow the repo's own rules for worktrees and branches (AGENTS.md, CLAUDE.md).
3. Look for a cheaper delivery shape before assigning models. Common wins:
   - Merge tiny units into one worker so you pay one orientation cost, not three.
   - Split a mixed unit so the mechanical half runs on the light tier and only the hard half runs on the frontier tier.
   - Run an investigation on the frontier tier first, then hand its written findings to a standard-tier implementer.
   - Do a trivial unit yourself instead of spawning a worker for it.
   - Order units so dependent ones start from a reviewed result, not a guess.
4. Create the scratchpad (see Scratchpad).

## Step 2: Pick a tier for each unit

Pick the **lowest tier that will reliably get the unit done.** Reliably means first time, without you redoing it. A cheap model that needs two retries costs more than the right model once.

| Tier | Work it fits | Claude Code | Codex | Gemini CLI |
|---|---|---|---|---|
| Light | Mechanical edits, renames, copy changes, docs, running tests and reporting, lookups, Linear and PR bookkeeping | `haiku` low for pure lookups; `sonnet` low or medium otherwise | `gpt-6-luna` low or medium | Flash |
| Standard | Well-specified feature slices, refactors that follow an existing pattern, writing tests against a clear spec, fixing a diagnosed bug | `sonnet` high, or `opus` medium | `gpt-6-luna` high, or `gpt-6-sol` medium | Flash, or Pro for larger slices |
| Frontier | Root-causing bugs, architecture and design, cross-cutting or security-sensitive changes, ambiguous specs, reviewing a risky diff | `opus` xhigh; `fable` high or max for the hardest | `gpt-6.1-sol` high or xhigh | Pro |

Model names drift. Before the roster, confirm the names against what the host offers (`/model`, or the Agent tool's model list) and use the current equivalents.

Escalate a tier when a unit fails its acceptance criterion for a reason the brief did not cause. Do not escalate on the first failure if the brief was the problem; fix the brief. Record every escalation in the scratchpad.

## Step 3: Get approval for the roster

Before spawning anything, show the roster and wait for approval. Use `AskUserQuestion` (or the host's equivalent; on Codex and Gemini, ask in plain text and stop). Put the roster in the question's preview:

```
PM: opus @ high (this session)
Scratchpad: ~/.agents/scratchpads/<repo>/<slug>.md

#  Agent        Model @ effort    Unit                               Why this tier
1  investigator opus @ xhigh      Root-cause the duplicate webhook   Unknown cause, needs tracing
2  implementer  sonnet @ high     Fix + regression test from #1      Spec is clear once #1 lands
3  docs         sonnet @ low      Update the runbook section         Mechanical
                                   Order: 1 -> 2, 3 runs in parallel
```

Options, recommended first:

1. Approve as shown (Recommended).
2. A cheaper variant, if one is reasonable (name what drops a tier and the risk).
3. A safer variant, if one is reasonable (name what goes up a tier and why).

The user can pick Other to change anything. Re-show the roster after any change. A later change to the roster (an escalation, a new unit) needs approval again, except escalating one tier after a failure, which you record and report.

## Step 4: Delegate

Each worker gets a self-contained brief. Workers do not see this conversation, so the brief carries everything:

```
GOAL        one sentence, the outcome
SCOPE       paths it may write, paths it may not, its worktree or branch
CONTEXT     file pointers, the ticket, findings from units it depends on
ACCEPTANCE  checkable criteria, one per line
VERIFY      the exact commands to run
SCRATCHPAD  <absolute path>; read it first, write your section, ask questions there
FORBIDDEN   no push, no PR, no force-push, no edits outside scope, no Linear changes
REPORT      status, branch, head SHA, commands run and their results, deviations
```

Size the brief to the unit. A one-line change gets a short paragraph that still names the goal, scope, verify command, and scratchpad.

How to spawn, by host:

- **Claude Code.** The `Agent` tool with `model` and `effort` set from the roster. Run independent units in one message so they run in parallel; use `run_in_background` for long ones. Give each writer its own worktree, created the repo's way if it documents one; `isolation: "worktree"` otherwise.
- **Codex.** `spawn_agent` with `model` and `reasoning_effort` from the roster. Give each writer its own worktree.
- **Gemini CLI.** A subagent's model comes from its definition file (`.gemini/agents/<name>.md`, `model:` in its frontmatter). Use a defined agent whose model matches the tier. If none exists, say so in the roster and offer to add one or to run that unit in the session instead.

One writer per worktree. Two workers never write the same file at the same time.

## Step 5: Review every result

A worker's report is a claim, not evidence. For each unit:

1. Read the actual diff (`git diff`, `git log`) in the worker's worktree.
2. Run the verify commands yourself and judge them by exit code.
3. Check the diff stays in scope and follows the repo's patterns.
4. If it falls short, send a fresh brief with the specific gap (a new spawn with consolidated scope, not a chain of resumes). If it fails twice on a sound brief, escalate one tier.
5. Note the verdict in the scratchpad.

For a risky diff, have a frontier-tier reviewer from a different model family check it before you accept it, and put that reviewer on the roster.

## Step 6: Ship

You raise the PRs. Workers never do.

1. Follow the user's and the repo's PR workflow from their instructions (AGENTS.md, CLAUDE.md). Use the existing skills for the steps they name, such as `/simplify`, `/warm` for new dependencies, `/visual-recap`, `/triage`, and `/ship-pr` to babysit CI and land.
2. Put the Linear ticket in the PR description, not the title.
3. Update Linear as you go: In Progress at the start, the PR link and In Review when the PR opens, Done when it merges. Comment on the ticket when the plan changes.
4. Merging to a deploying branch is a production action. Follow the repo's merge rules and ask first unless the user already told you to land it.

## Scratchpad

All agents share one markdown file for the work. It is how the team talks to each other and to you.

- **Path.** `~/.agents/scratchpads/<repo-name>/<work-slug>.md`, for example `~/.agents/scratchpads/project100x/red2-140-webhook-dedupe.md`. It sits outside every worktree, so all workers see the same file and nobody commits it by accident. Pass the absolute path in every brief.
- **Layout.**

  ```markdown
  # <work title> (<ticket>)

  ## Status (PM only)
  Roster, unit states, current decisions, open questions for the user.

  ## Decisions (PM only)
  - <date> <decision> because <reason>

  ## <agent name>: <unit>
  Notes, findings, blockers, handoffs.

  ## Questions
  - [<agent> -> PM] <question> | answer: <PM's answer>
  ```

- **Rules.** The PM writes the Status and Decisions sections and answers Questions. Each worker writes only under its own heading and appends to Questions. Append, never rewrite another agent's text. Read the file before starting and before reporting. Findings a later unit needs go here, and you also paste them into that unit's brief.
- When the work ships, leave the file in place as the record and link it in your final report.

## Questions

Make the decision yourself whenever you can: the codebase, the ticket, the repo's instructions, or a sensible default answers most questions. Record the call in Decisions.

When you cannot decide (a product call, a real trade-off, a missing fact only the user has), ask the user **one question at a time**:

- State the question in one sentence.
- Give your recommendation first, marked Recommended, with one line of reasoning.
- Give the alternatives, each with its trade-off.
- Wait for the answer before the next question. Keep other units running while you wait if they do not depend on it.

Worker questions come to you through the scratchpad. Answer them yourself if you can. Only the ones you cannot answer go to the user, one at a time, in the same format.

## Done

If the work changed anything a user can see, build the completion walkthrough before reporting: read `references/walkthrough.md` and follow it. It is one page with a before-and-after recording of each change, a status label for each, and feedback and question boxes. Put the recording in the roster as its own unit.

Report to the user:

- The walkthrough link, or one line saying why there is none (backend-only, nothing to show).
- The ticket, each PR link, and whether it merged (or exactly what blocks it).
- The roster as it ran: each unit's model and effort, any escalation and why, and anything you did yourself.
- Review findings you acted on and any you declined, with the reason.
- The scratchpad path.
