---
name: visual-recap
description:
  Generate and maintain the system recap block in a PR description - a
  GitHub-rendered visual summary of which system primitives a change touches,
  how risky it is, and what changed. Use when planning a non-trivial change
  (plan mode), when creating or updating a pull request (recap mode), when
  running `gh pr create` or `gh pr edit`, or when the user asks for a visual
  recap, visual plan, system review, or PR recap.
---

# System recap (visual plan / visual recap)

Produce a high-altitude, visual review aid directly in the PR description. No
deployment, no third-party service: GitHub renders the block (including mermaid
diagrams), and the PR itself is the storage. A future viewer app can ingest the
same marker-delimited block via the GitHub API, so follow the format exactly.

The recap is informational and non-blocking. It supplements the PR description
and normal code review; it never replaces reading the diff.

## Two modes, one format

- **Plan mode** (before/while implementing): describe the intended change
  against the current system. If no PR exists yet, put the block in the plan
  document or message; move it into the PR description once the PR exists.
- **Recap mode** (PR creation and every meaningful update): describe what the
  diff actually does. Replaces a plan-mode block if one exists.

## Source-of-truth rules (non-negotiable)

1. **Recap mode reads the diff, not memory.** Generate the recap from
   `git diff <base>...HEAD` (plus `git diff --stat`) against the PR base branch.
   Session context may explain intent, but every claim about what changed must
   be checkable against the diff.
2. **Classification is checked against the primitives map when one exists.**
   Look for a primitives map at `docs/contributing/architecture/primitives.yaml`
   (fall back to `docs/architecture/primitives.yaml` or `primitives.yaml` at the
   repo root). If one is found, read it before classifying and use its `id`
   values verbatim. **If no map exists**, derive the primitives from the repo's
   own structure — top-level services, apps, packages, or modules, named exactly
   as the repo names them — and record `**Primitives map:** none — derived from
   repo structure` in the block so a reader knows the classification is
   inferred, not checked. Never invent primitive IDs that match neither a map
   nor a real path in the repo.
3. **The map stays current.** If a map exists and the PR adds, removes, or
   materially reshapes a primitive, update the map in the same PR and say so in
   the block. If no map exists, do not create one as a side effect of this
   skill — mention it as a suggestion only if the repo would clearly benefit.

## Risk classification

Classify each touched primitive, then roll up to the highest severity as the
overall classification (`adds` > `extends` > `composes`):

| Classification | Meaning                                                    | Risk   |
| -------------- | ---------------------------------------------------------- | ------ |
| `composes`     | Uses existing primitives as-is; wiring and call sites only | Low    |
| `extends`      | Changes a primitive's behavior, shape, or contract         | Medium |
| `adds`         | Introduces a new primitive (update the map if one exists)  | High   |

A change touching a documented invariant (for example per-user isolation, tenant
scoping, or an ordering guarantee) is called out explicitly regardless of
classification — from the map's `invariants` when a map exists, otherwise from
invariants stated in the repo's own docs or code comments.

## Block format

The block lives in the PR description between HTML comment markers, wrapped in
`<details>`. Fixed section order — a future ingestion process parses this
structure. Omit optional sections rather than leaving them empty.

````markdown
<!-- system-recap:start -->

<details>
<summary>System recap — <b>composes existing primitives</b> (low risk)</summary>

**Mode:** recap · **Base:** `main` @ `abc1234` · **Head:** `def5678`
**Primitives map:** `docs/contributing/architecture/primitives.yaml`

**Classification:** composes — no primitives added or changed; this PR wires
existing primitives together.

### Primitives touched

| Primitive    | Group    | Impact                                  |
| ------------ | -------- | --------------------------------------- |
| `mcp-server` | surfaces | composes                                |
| `d1-app-db`  | storage  | extends — new `jobs.retry_count` column |

### System map

```mermaid
flowchart LR
	mcpServer["mcp-server"]:::touched
	capabilityRegistry["capability-registry"]:::untouched
	d1AppDb["d1-app-db"]:::extended
	mcpServer --> capabilityRegistry --> d1AppDb
	classDef touched fill:#1a7f37,color:#fff
	classDef extended fill:#9a6700,color:#fff
	classDef added fill:#cf222e,color:#fff
	classDef untouched fill:#57606a,color:#fff
```

### Change flow

_Optional: a mermaid flowchart or sequence diagram of the specific change._

### Before / after

_Optional: schema, API shape, or route changes as compact before/after fenced
blocks or tables._

### Invariants

_Optional: only when the change touches a documented invariant._

### Plan vs actual

_Recap mode only, when a plan-mode block existed: what shipped as planned and
what drifted, in a short list._

</details>

<!-- system-recap:end -->
````

Format rules:

- The `<summary>` line always carries the overall classification and risk in
  bold so reviewers see it without expanding.
- The `**Primitives map:**` line always states which map was used, or
  `none — derived from repo structure`. Never omit it.
- Blank line after `<summary>` and around every fenced block, or GitHub will not
  render the markdown/mermaid inside `<details>`.
- **System map**: show touched primitives plus their immediate neighbors — not
  every node in the system. Color with the four `classDef` styles above
  (`touched` = composes, `extended`, `added`, `untouched` for context nodes).
  Quote node labels containing spaces or special characters.
- Keep the whole block scannable: prefer tables and diagrams over prose, and
  keep it well under ~120 lines.

## Workflow

### Recap mode (PR create/update)

1. Locate the primitives map (rule 2). Read it if present; otherwise plan to
   derive primitives from the repo structure.
2. Get the facts: `gh pr view <n> --json baseRefName,headRefName`, then
   `git diff <base>...HEAD --stat` and the full diff for anything you did not
   author this session.
3. Map changed paths to primitives; classify each; roll up the overall
   classification.
4. Author the block following the format above.
5. Upsert it into the PR description, using the script that sits next to this
   SKILL.md (the skill's own directory is given to you when the skill loads):

   ```bash
   node <skill-dir>/scripts/upsert-recap-block.mjs <pr-number> <block-file>
   ```

   The script replaces the content between the markers, or appends the block to
   the end of the description on first run. It never touches text outside the
   markers, so a hand-written PR description survives intact.

6. Re-run steps 2-5 after pushing significant new commits to the PR.

### Plan mode

Same steps, except: `**Mode:** plan`, no Base/Head commits required, "Primitives
touched" describes intended impact, and add a one-line note when the plan
requires **no** change to any primitive — that is the lowest-risk outcome and
worth stating explicitly. When implementation later diverges from the plan, the
recap's "Plan vs actual" section records the drift.

## Provenance

Adapted from [`kentcdodds/kcd-skills`](https://github.com/kentcdodds/kcd-skills/tree/main/skills/visual-recap)
(MIT, © 2026 Kent C. Dodds). Changes from upstream: the primitives map is
optional rather than required — upstream hard-depends on a
`docs/contributing/architecture/primitives.yaml` that most repos do not have, so
this version falls back to deriving primitives from repo structure and records
which source it used. The script path is resolved from the skill directory
rather than a fixed `.agents/skills/...` repo path.
