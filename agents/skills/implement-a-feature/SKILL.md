---
name: implement-a-feature
description: Use when directing an AI agent to BUILD a planned feature without losing control of what ships. Sets guardrails (tests, linting, static analysis) before code, uses AGENTS.md + hooks, works test-first in small stacked branches, reviews and refines agent decisions, and tracks progress with checklists. Triggers on "implement this feature", "build this with an agent", "set up guardrails / AGENTS.md / hooks", "drive the agent to build", "review the agent's code before merge".
---

# Implement a Feature with an AI Agent

A repeatable workflow for building a planned feature with an AI agent while staying in
control of quality. This workflow is **practices-driven** — guardrails and habits rather
than canned prompts.

Source: Unlearn "Build Features with an AI Agent" workflow
(<https://app.unlearn.dev/workflows/implement-a-feature-with-an-ai-agent>). Study notes:
`../../lessons/03-implement-a-feature.md`. Comes after `plan-a-feature` (which produces
`feature-[NAME].md` with ordered steps and a test plan).

## Principles
- **Guardrails before code.** Steer the agent and stop it overbuilding.
- **Steer deliberately.** Permissions, plan mode, context, file targeting, model/effort.
- **`AGENTS.md` removes guesswork** and compounds — every correction becomes a rule.
- **Tests before code.** Concrete target first; confirm failure; then implement.
- **Small, resumable units.** Stacked PRs, saved checklists, an AI review pass.

## When to use
After a feature is planned (`feature-[NAME].md` with implementation steps + tests). Use to
set the project up for agent work and to drive each step to merge.

## Procedure

### Set-up (once per project)
1. **Guardrails in the boilerplate** — install/configure a **testing framework, linting,
   and static analysis**.
2. **Get fluent steering the agent** — know how to use **permissions, plan mode, context,
   targeted file selection, and model/effort selection**.
3. **Write `AGENTS.md`** — coding standards, development philosophy, preferred
   tools/packages, and the stack. Base it on <https://github.com/unlearndev/agent-starters>.
4. **Add hooks** — define expected checks in `AGENTS.md` and back them with project-level
   hooks so lint/static-analysis/tests run automatically after edits.

### Per implementation step (the loop)
5. **Plan in-agent, then tighten** — remove out-of-scope items, clarify vague steps,
   simplify the UI, catch scope creep.
6. **Tests first** — write tests from the feature plan, review them, **pause and confirm
   they fail**, then let the agent implement against them.
7. **Work in a small, focused branch** — one stacked PR per step; keep diffs reviewable.
8. **Review & refine** — catch what tests miss (ignored framework conventions, duplicated
   logic); refactor to the right abstraction; **add the rule to `AGENTS.md`**.
9. **Rapid cycle** — batch concrete issues, fix one by one, promote each fix to a
   convention.
10. **Local AI review before push** — hand the staged diff (or feature area) to another
    agent; expect findings grouped by severity with file references and suggested fixes.
11. **Track with a checklist** — generate a markdown checklist (e.g. from review findings),
    store it with the project, and tick items off as they're done and verified.
12. **Save the plan to resume** — keep the plan/checklist locally so long features can be
    paused and picked up later, continuing the same review-first cycle.

## Completion checklist (per step)
- [ ] Guardrails in place (tests, lint, static analysis) and running via hooks.
- [ ] `AGENTS.md` reflects current standards and any new corrections.
- [ ] Tests written first and confirmed failing before implementation.
- [ ] Implemented in a small, focused branch / stacked PR.
- [ ] Reviewed (incl. an AI pass); fixes tracked on a checklist; all checks pass.

## Notes
- Vault copy (study/reference). To activate: copy this dir into a project's
  `.claude/skills/` or `~/.claude/skills/`.
- Related course skills: `code-review`, `checklist` in <https://github.com/unlearndev/skills>.
