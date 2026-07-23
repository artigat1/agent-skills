---
name: stacked-prs
description: Repo conventions and GitHub-side merge semantics for GitHub Stacked PRs. Use when the user says "stack these PRs", "stacked PRs", "split this into a stack", "break this branch into smaller PRs", or when merging / reviewing / rebasing an existing stack. For gh-stack CLI command mechanics, use the companion gh-stack skill (the official one from github/gh-stack).
---

# Stacked PRs — conventions & merge semantics

GitHub's native stacked-PRs feature (private preview; must be enabled per repository — CLI exit code 9 means it isn't). A stack is an ordered chain of PRs: the bottom PR targets trunk, each PR above targets the branch below. GitHub shows a stack map on every PR and evaluates branch protection and CI for **every layer as if it targeted the stack base** (trunk).

**CLI mechanics live in the official `gh-stack` skill** (installed from `github/gh-stack`, version-matched to the extension). It covers non-interactive rules (`view --json`, `submit --auto`, always pass branch args), the JSON schema, exit codes, and conflict recovery. This skill covers what that one doesn't: repo conventions and how stacks behave on GitHub itself.

Docs: <https://github.github.com/gh-stack/>

## Repo conventions (ow-copilot)

- Trunk is **`staging`** (the repo default, so `gh stack init` needs no `--base`). Never target `main`.
- CI: native stacked PRs trigger workflows as if each PR targets the stack base, so the `run-ci` label should be unnecessary. **Verify checks actually start on upper PRs after `submit`**; if they don't, fall back to adding the `run-ci` label to each stacked PR.
- `submit --auto` creates draft PRs with auto-generated titles and there is no custom title/body flag — after submitting, set a proper title and description (`.github/pull_request_template.md`, manual-testing checklist) with `gh pr edit <n> --title ... --body-file ...` on **each** PR, post a `/triage` comment per PR, then `gh pr ready <n>` (or `submit --auto --open`).
- Each PR should be independently reviewable in ~15 minutes — that's the point of stacking.
- Structure by dependency: foundational changes (models, migrations, shared types) in lower branches; API routes, UI, tests above. One stack = one feature; unrelated work gets its own stack.

## Merge semantics (GitHub-side)

- Merging any PR merges **it plus every unmerged PR below it** in one atomic, bottom-up operation. You cannot merge a middle PR while leaving a lower one unmerged. Merging is **not supported from the CLI** — use the PR page.
- Partial merges are fine: remaining PRs are automatically rebased and retargeted at trunk (server-side). After a full merge, `gh stack submit` on new branches starts a fresh stack.
- All three merge methods work: squash → one commit per PR; merge commit → one merge commit for the merged group; rebase → commits replayed linearly. Merge queue is supported — the stack enters the queue in order; if one PR is ejected, everything above it is too.
- Requirements to merge: every PR at-or-below must pass checks and branch protection (evaluated against trunk), and the stack must have a fully linear history (fix with `gh stack rebase`).
- Closing a middle PR blocks everything above it from merging (the stack relationship is preserved).
- The UI **Rebase Stack** button rebases server-side but produces **unsigned commits** — prefer `gh stack rebase` locally, which uses local signing config.
- Cross-fork stacks are not supported; all branches must live in the same repo. Stacks are strictly linear — one parent, one child per branch; parallel workstreams need separate stacks.

## CI / Actions metadata

Workflows on stacked PRs can read `github.event.pull_request.stack`: `.number`, `.size`, `.position` (1 = bottom), `.base.ref`, `.base.sha`. Relevant if a workflow needs stack-aware behaviour.

## Reviewing a stack

Each PR shows only its own layer's diff. Read bottom-up for full context; the stack map at the top of each PR navigates between layers. Feedback that belongs in a lower layer: check out that branch, commit there, `gh stack rebase --upstack`, push — never patch a lower layer's concern in a higher branch, or the diffs end up in the wrong PRs.
