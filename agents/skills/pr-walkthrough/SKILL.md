---
name: pr-walkthrough
description: Create and maintain an animated architecture and data-flow walkthrough in a PR description, with an optional interactive viewer. Use when creating or updating a large or complex PR, or when asked for a PR walkthrough like orbitalwitness/project100x#11507. Supplements triage and visual-recap. Skip routine small changes.
---

# PR walkthrough

Give reviewers a short tour of what changed, in the order they need to understand it. Produce a self-playing SVG for the PR description and a self-contained HTML viewer with play, step, pan, zoom, and file links. The model reads the diff and authors the graph. The bundled PR Lens packages validate and render it locally.

## When to include one

On PR creation or a meaningful update, add a walkthrough when the change spans several interacting components, moves work across a boundary, changes a multi-step flow, or introduces architecture that a static recap cannot explain clearly. Judge the explanation needed, not just the line count. Generated files and lockfile churn alone do not qualify. An explicit request also qualifies.

Skip a routine small fix, rename, or isolated refactor. Do not stretch one change into an artificial tour. Keep the existing triage and visual-recap blocks. They remain the risk map and system overview; this is the guided explanation.

## Get the facts

Read the actual PR metadata and diff, including changes authored earlier:

```bash
gh pr view <pr> --json baseRefName,headRefName,baseRefOid,headRefOid,url
```

Fetch the actual base from its remote, including for stacked PRs. Diff `<base-remote>/<base-branch>...HEAD` with `--find-renames`, plus `--stat`. Check that the local HEAD is the PR head before publishing. Before a PR exists, use its intended base. Never assume `main`.

Trace the changed flow and its immediate unchanged neighbours. Read enough source to substantiate each node, edge, caption, and file reference. Use repository navigation tools when available. Record the repository and real merge-base/head SHAs in `provenance`. Removed code uses base file references; current code uses head references.

## Prepare the renderer

`<skill-dir>` is the directory containing this SKILL.md, wherever the plugin is installed. Keep runtime files outside the plugin installation and the target checkout. Copy the skill into a temporary directory so npm never writes into a shared skill cache:

```bash
runtime_dir="$(mktemp -d "${TMPDIR:-/tmp}/pr-walkthrough.XXXXXX")"
cp -R <skill-dir> "$runtime_dir/skill"
work_dir="$runtime_dir/output"
mkdir -p "$work_dir"
bash "$runtime_dir/skill/scripts/setup.sh"
```

Keep these paths for subsequent calls. Setup checks Node 20.11+ and npm, installs the locked packages, builds the renderer, and compiles the fictional example. No provider key or PR Lens account is needed. Do not commit runtime files or generated outputs.

Read [references/graph-document.md](references/graph-document.md) for the contract and [examples/checkout.graph.json](examples/checkout.graph.json) for a complete fictional tour before authoring the first document. Write the graph to `$work_dir/graph.json`.

## Author the tour

- Use 3 to 7 steps when the change supports them. Each step explains one concrete change. Put the headline change first, supporting changes next, and any overview last.
- Write a heading of at most 48 characters naming what changed. Use sentence case and words such as added, removed, replaced, now, moved, or split. If it could have been true before the PR, it is not a change heading.
- Write a required body of at most 140 characters stating the effect on behaviour. Use short, plain sentences. Include counts or timings only when supported by the code or recorded evidence.
- Focus on 2 or 3 relevant elements. A focus that lights up half the diagram teaches little.
- Include immediate unchanged neighbours with `delta: "unchanged"`. Arrange lanes by runtime, tier, or boundary. One useful architecture view is enough; add flow views only for sequences worth following.
- Attach real file references so reviewers can open the code. Use one hero edge, at most two, for the connection the change is about.
- Explain the change. Do not invent findings, correctness claims, benchmark results, or deployment guarantees. Triage owns risk classification.

A step's `focus` is an object, never an array of IDs:

```json
{
  "id": "capture-moved",
  "heading": "Capture moved to a worker",
  "body": "Checkout writes the order first. A worker then captures the payment.",
  "stage": { "kind": "view", "view": "new-path" },
  "focus": { "kind": "selection", "nodes": ["capture-job", "worker"], "edges": ["order-to-queue"] }
}
```

The IDs must exist in the document. Omit `stage` to stay on the previous diagram. Each child view narrows its parent's scope; separate data-flow views can be roots.

## Validate and compile

```bash
node "$runtime_dir/skill/scripts/node_modules/@coldtea/pr-lens-cli/dist/bin.js" validate "$work_dir/graph.json"
node "$runtime_dir/skill/scripts/walkthrough-svg.mjs" "$work_dir/graph.json" "$work_dir/walkthrough.svg"
node "$runtime_dir/skill/scripts/build-viewer.mjs" "$work_dir/graph.json" "$work_dir/viewer.html"
```

Fix all validation failures. Both compilers also parse through the schema, fill defaults, and refuse invalid documents. Do not delete a meaningful element merely to silence a failure. Check that both outputs exist and that the captions, focus regions, and file links match the source. Inspect rendered output with available browser tooling when possible. The SVG loops with each step held for 4 seconds. The HTML inlines its renderer and makes no external requests until a reviewer opens a file link.

## Put it in the PR description

For a PR you are authorized to create or update, add this block near the top, after the problem statement. Keep it visible; leave triage and system recap in their own collapsible blocks.

```markdown
<!-- pr-walkthrough:start -->

## Walkthrough

![Steps showing the order write, queued capture, and payment callback](<uploaded-svg-url>)

Interactive: <published-viewer-url>. Play, step, pan, zoom, or click a card for its files.

<!-- pr-walkthrough:end -->
```

Use alt text that says what this tour shows. Include the Interactive line only when a working viewer URL exists.

Read the latest PR body immediately before editing. Replace only the existing `pr-walkthrough` marker pair, or insert a new block after the problem statement. Preserve everything else, including triage, system recap, review coverage, testing, rollout, and final commit trailers. If markers are incomplete or duplicated, resolve their boundaries before replacing text. Keep unrelated section order intact.

Check `gh pr edit --help` for attachment support. When supported, put the SVG's actual local path in a Markdown image reference in the prepared body file, then pass that same path to `--attach`:

```bash
gh pr edit <pr> --body-file "$work_dir/body.md" --attach "$work_dir/walkthrough.svg"
```

GitHub CLI replaces the Markdown image path with the uploaded attachment URL. An HTML `<img>` does not get that replacement. If attachments are unsupported, use an available authorized upload tool or provide the local SVG for manual attachment. Do not publish broken local paths or claim the upload succeeded. Re-read the saved PR body to verify the image reference and preserved sections.

On meaningful diff changes, update the graph against the current base/head and replace this block. Retain existing attachment and viewer URLs when the walkthrough content has not changed. Remove stale walkthrough claims when scope shrinks.

## Optional interactive hosting

Local generation and PR attachment do not require hosting. For a private source repository, use only an approved private destination. A private repository can still have public Pages, so check both. Never run PR Lens `canvas push` or send source graphs to its public third-party canvas.

If the project already has a walkthrough publishing workflow, use its documented destination. Otherwise, when an approved private GitHub Pages repository is configured and publishing is authorized:

```bash
PR_LENS_PAGES_REPO=<owner/private-site-repo> bash "$runtime_dir/skill/scripts/publish-pages.sh" "$work_dir/viewer.html" <source-repo-name> <pr>
```

The script requires an explicit destination, refuses public repositories or public Pages, and pushes to the site's default branch. Use it only where that branch is the documented publishing source. Do not create a hosting repository, enable Pages, or change visibility as a side effect. A disabled Pages site yields a GitHub file link, not a live interactive viewer. Report that limitation and omit the Interactive line. Keep the local HTML available if hosting is unavailable.

## Provenance

Adapted from Orbital's [pr-lens-walkthrough skill](https://github.com/orbitalwitness/project100x/tree/main/.agents/skills/pr-lens-walkthrough), used by [PR #11507](https://github.com/orbitalwitness/project100x/pull/11507). SVG compiler, viewer, and publishing scripts originate there. This version adds large-change selection, works from an installed skill directory, uses the actual PR base, preserves neighbouring PR sections, and requires an explicit hosting destination.

Renderer, schema, validator, and graph contract are [PR Lens](https://github.com/coldteadotai/pr-lens) by Coldtea, MIT. See [references/LICENSE-pr-lens](references/LICENSE-pr-lens).
