---
name: plan-the-product
description: Use when turning a vague product idea into a structured, build-ready spec BEFORE any code is written. Guides the full Unlearn "plan the product" workflow — idea → spec.md → shaping → technical constraints → boundaries → AI mockups → adversarial critique → features.md → boilerplate scaffold. Triggers on "spec a product", "plan the product", "turn this idea into a spec", "write a spec.md", "plan a new app/feature before building".
---

# Plan the Product

A repeatable workflow for specifying a product before AI builds it. Produces two
artifacts the rest of the build depends on: **`spec.md`** (the single source of truth) and
**`features.md`** (a high-level, implementation-ordered feature list).

Source: Unlearn "Plan the Product" workflow
(<https://app.unlearn.dev/workflows/plan-the-product>). Study notes for the underlying
lessons live alongside this skill in the vault at
`../../lessons/01-plan-the-product.md`.

## Principles
- **Spec first, code later.** Don't write or scaffold code until the spec is sharp.
- **The spec is a conversation.** Iterate by asking the AI to review, critique, role-play
  users, and offer options — not by writing the whole thing yourself.
- **Keep core features product-focused.** No DB schemas, file paths, class names, or API
  endpoints in the feature descriptions — technical detail lives in its own section.
- **Boundaries are as important as goals.** Be explicit about what NOT to build.
- **Mockups are a spec test.** If AI-generated wireframes look wrong, the spec is unclear.

## When to use
Use at the very start of a new product, app, or sizeable feature — whenever the idea is
still vague and you want AI agents to build the right thing on the first pass.

## Inputs
- A rough idea (even one sentence is enough to start).
- Any supporting material: notes, screenshots, sketches, wireframes, transcripts. Put
  them in a folder the agent can read before drafting.
- A spec template to fill: `templates/spec_simple.md` (small projects) or
  `templates/spec_advanced.md` (larger projects — adds non-goals, user stories, flows,
  notifications, edge cases, dependencies, security, metrics).

## Outputs
- `spec.md` — refined product specification.
- `features.md` — high-level features ordered for implementation.
- (Optional) a zero-feature boilerplate that runs and reflects the chosen stack.

## Procedure

Work through the stages in order. Each stage lists its purpose and the prompt(s) to use.
Substitute the bracketed placeholders. Loop back to earlier stages whenever a later stage
exposes a gap.

### 1. Draft an initial spec from the idea
Gather everything provided and identify meaningful gaps before drafting. Ask clarifying
questions **upfront** (especially audience, technical stack, constraints) rather than
spreading them across turns. Then draft a concise spec into `spec.md`, following the
chosen template, and call out any significant assumptions.

> "I want to build [plain-English description of the idea, the users, and what they can
> do]. Create a spec.md file for this please."

Add supporting documents at any point:

> "I have some more documents here. Please update spec.md"

### 2. Shape the specification
Tighten the draft: merge redundant roles, strip noise, cut scope.

> "Can we consolidate [role A] and [role B] into one? No need for separate roles here."

> "Please remove any technical details from the core features (including proposed fields)"

> "Remove [section], [section], etc."

> "Remove from [section]:
> - [Item 1]
> - [Item 2]"

### 3. Add light technical constraints
Introduce preferred language, framework, database, styling — enough to constrain feature
shape. Decisions need not be final.

> "Add a section around technical stack. We're using [framework], [tool], [frontend
> framework] and [database]. We're using [library] for styling."

### 4. Define boundaries (what NOT to build)
Probe what the AI would build from the current spec, then nail down limits.

> "Using this spec, tell me what you'd end up building in detail. Tell me the features
> you'd add in detail, the flows you'd create and the technical decisions you'd make."

> "Update spec to specify:
> - [Boundary / change 1]
> - [Boundary / change 2]"

### 5. Expose gaps with AI mockups
Generate rough designs from the spec; mismatches reveal where the spec is unclear.

> "Using spec.md, please generate what you think [feature/page] will look like."

> "Please specify in spec.md that we don't need [feature] for [page]."

> "Please regenerate the example design"

### 6. Poke holes in the plan
Have the AI act as an outside reviewer and walk real user journeys and failure scenarios.

> "What if [service/dependency] goes down?"

> "Ok, let's swap out [previous feature/service/mechanism], and replace with [new
> feature/service/mechanism]"

### 7. Ask what's missing
Flip the conversation — let the AI surface what you haven't considered.

> "Based on the spec, what might we have missed?"

> "Please give me choosable options for each of these one by one, so I can decide."

### 8. Generate features from the spec
Extract a high-level, product-focused feature list as `features.md`.

> "Read spec.md and extract the core product features. Create a new document called
> features.md.
> For each feature include:
> - Feature name
> - Short description (1–2 sentences)
> - User flow (how a user interacts with this feature step-by-step)
> - UI overview (what the user sees or interacts with)
> Keep everything high level and product-focused.
> Do NOT include:
> - database schemas
> - file names
> - file paths
> - class names
> - API endpoints
> - implementation details
> Only include features that are clearly described in spec.md. Do not invent new features."

Order for implementation, then reconcile the two documents:

> "Could you re-arrange these in a sensible implementation order?"

> "Can you sync back any changes we made to the features here into the original spec.md
> file so there are no discrepancies?"

### 9. Scaffold the boilerplate (optional)
Stand up a zero-feature starter that runs and reflects the stack — a throwaway prototype
to validate the technical direction.

> "Generate a Claude Code prompt to create an overall app layout for our project,
> including logo (text based), menu items, [primary action] button, and main slot content
> area. This should be design based only and not functional yet. We're scaffolding our
> boilerplate."

## Completion checklist
- [ ] `spec.md` exists, follows the template, and significant assumptions are noted.
- [ ] Core features contain no technical/implementation detail.
- [ ] Technical stack section present.
- [ ] Explicit boundaries / non-goals captured.
- [ ] Spec stress-tested via mockups, hole-poking, and "what did we miss".
- [ ] `features.md` generated, implementation-ordered, and synced with `spec.md`.

## Notes
- This is the vault copy of the skill (study/reference). To make it active in a project,
  copy this directory into that project's `.claude/skills/` (or your global
  `~/.claude/skills/`).
- The course also ships the spec and feature steps as standalone installable skills:
  `npx skills add unlearndev/skills` (or `--skill spec-generator` /
  `--skill feature-generator`). See <https://github.com/unlearndev/skills>.
