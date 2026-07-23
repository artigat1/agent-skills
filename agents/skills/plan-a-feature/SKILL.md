---
name: plan-a-feature
description: Use after a product spec exists, when turning ONE feature from features.md into a standalone, build-ready feature spec an AI agent can implement without guessing — behaviour, technical decisions, explicit out-of-scope constraints, ordered reviewable implementation steps, and a tests-first plan. Triggers on "plan a feature", "design this feature", "break this feature into steps", "write a feature spec", "feature-x.md", "plan the implementation of [feature]".
---

# Plan a Feature

A repeatable workflow for designing a single feature so precisely that an AI agent can
build it without guessing. Produces `feature-[NAME].md` containing the feature's spec,
technical decisions, constraints, ordered implementation steps, and a behaviour-first test
plan.

Source: Unlearn "Plan a Feature" workflow
(<https://app.unlearn.dev/workflows/plan-a-feature>). Study notes:
`../../lessons/02-plan-a-feature.md`. Comes after the `plan-the-product` skill, which
produces `spec.md` and `features.md`.

## Principles
- **One feature, one document.** Isolate it from the wider product to reason clearly.
- **Behaviour before technical shape.** Decide what it does, then how — deliberately.
- **AI over-builds.** It's a pattern matcher; name what it must NOT add.
- **Right-sized steps.** Big enough to ship something usable, small enough to review.
- **Tests before code.** Tests written over wrong code are wrong; anchor on behaviour.

## When to use
After `spec.md` + `features.md` exist (see `plan-the-product`), when you're about to build
a specific feature and want a plan an agent can execute precisely.

## Inputs
- `features.md` and `spec.md` from the product-planning stage.
- The name of the one feature you want to plan now.

## Outputs
- `feature-[NAME].md` with: Summary, Goals, Requirements, Technical section, Constraints
  (out-of-scope), Implementation Steps (ordered), and Tests per step.
- Optionally, per-step Claude Code prompts and test-writing prompts.

## Procedure

### 1. Extract the feature into its own spec
> "Extract the feature [feature] from features.md into its own markdown document,
> feature-[FEATURE_NAME].md.
>
> Instructions:
> - Preserve the original intent of the feature
> - Pull in any relevant requirements, constraints, assumptions, dependencies, edge cases, and related notes from elsewhere in features.md or spec.md
> - Exclude unrelated features or implementation details that do not directly support this feature
> - Rewrite the extracted feature into a clean, structured spec that is easier to plan in detail
>
> Output format:
>
> # [Feature Name]
>
> ## Summary
> A short plain-English summary of the feature and its purpose.
>
> ## Goals
> Clear outcomes this feature should achieve.
>
> ## Requirements
> Functional requirements only for this feature.
>
> Do not start designing the solution yet
> Do not propose any low level technical decisions"

Trim anything irrelevant:
> "Remove [section], [section], etc."

### 2. Lock in technical decisions
Add deliberate technical shape, then surface and resolve the agent's assumptions.
> "Add a technical section and include:
> - [Technical item 1]
> - [Technical item 2]"

> "How might you build this based on this feature document only? Give me the technical
> decisions you'd make in a simple list."

> "How are you going to implement [feature/mechanism]?"

### 3. Choose what's out of scope
> "What helpful additions might you sprinkle in if building this that we don't want?"

> "Add these to the constraints section and/or update applicable sections of the feature
> plan:
>
> [Feature you don't want]
> [Package you don't want to include]
> Etc."

### 4. Break into reviewable steps
> "Add a new section, "Implementation Steps" and break up this feature into smaller,
> ordered implementation steps. These steps should be large enough to add a significant
> and usable feature, but small enough that we can comfortably review it."

### 5. Preview how AI will build each step (optional)
> "Generate a Claude Code prompt for Implementation Step [step number], taking into
> account the context from this feature file, our features.md file and spec.md file."

### 6. Tests first — rationale
Don't let tests be an afterthought generated from possibly-wrong code. Define correctness
from behaviour first (lightweight TDD that works well with AI). No prompt — a mindset for
stage 7.

### 7. Write the test plan before the code
> "Add a simple bulleted list of tests under a Tests heading for each implementation step."

> "Generate a Claude Code prompt to write tests for Implementation Step [step number],
> using [testing framework]."

## Completion checklist
- [ ] `feature-[NAME].md` exists with Summary / Goals / Requirements (no premature design).
- [ ] Technical section present; key assumptions surfaced and decided.
- [ ] Constraints section lists explicit out-of-scope items/packages.
- [ ] Ordered Implementation Steps — usable but reviewable.
- [ ] Behaviour-level Tests under each step; test-writing prompts ready.

## Notes
- Vault copy (study/reference). To activate: copy this dir into a project's
  `.claude/skills/` or `~/.claude/skills/`.
- Related course skills: `feature-generator` in <https://github.com/unlearndev/skills>.
