---
name: code-review
description: Code review staged changes or a specific area of the codebase, optionally delegating to a chosen agent. Use when the user wants a code review.
argument-hint: "[agent] [feature]"
disable-model-invocation: true
allowed-tools: "Bash(git diff:*), Bash(git log:*), Bash, Read, Grep, Glob, Agent"
---

# Code Review

## Context

**Staged diff:**

!`git diff --cached`

**Recent commits (for context):**

!`git log --oneline -10`

## Arguments

Raw arguments: $ARGUMENTS

Parse the arguments as follows:

- **Agent** (optional, first argument): The CLI command or agent name to delegate the review to. Recognized values:
  - `claude` or `self` or empty — perform the review directly in this context (default)
  - Any other value — treated as a CLI command name (e.g. `codex`, `aider`, `goose`). The review will be delegated by invoking that command via Bash (see Delegation section).
- **PR** (optional): A GitHub PR URL, `owner/repo#123`, or PR number. When provided, inspect the PR metadata and review the PR diff.
- **Feature** (optional, remaining arguments after agent): A description of what part of the codebase to review (e.g. "voting functionality", "authentication", "API endpoints"). When provided, find and review all files related to this feature. When empty/omitted, review staged changes instead.

If only one argument is given and it does NOT match a known agent name (`claude`, `self`), treat it as a **PR** when it looks like a PR reference; otherwise treat it as the **feature**, with agent defaulting to `claude`.

## Instructions

### Determine what to review

1. **If a PR is specified** — inspect PR metadata, fetch/read the PR diff, and review that diff.
2. **If a feature is specified** — use Glob and Grep to find all files related to the described feature. Read those files and review them as existing code.
3. **If no PR/feature is specified and there are staged changes** — review the staged diff shown above.
4. **If no PR/feature is specified and there are NO staged changes** — tell the user: "Nothing to review. Either stage changes with `git add` or specify a feature to review, e.g. `/code-review voting functionality`." Then stop.

### PR preflight

When reviewing a PR, inspect its base branch before code review. If the PR targets `main`, `master`, `production`, or `prod`, add an `🟠 Error` finding that the PR should target the repository's development/staging branch instead. Valid integration branches are the repo's development/staging branches, such as `staging` or `develop`.

### Perform the review

Read surrounding source files as needed to understand context. Organize findings by file, then by severity.

Check comments with the same discipline as code. Comments should be concise and necessary; flag comments that restate obvious code or explain names that should instead be made readable through well-named variables/functions.

### Recurring checks

Classes of defect that pass a normal read and have been caught late more than once. Apply them whenever the code fits the shape:

- **Bounds set equal to someone else's bound.** When a value (min/max zoom, clamp, page size, retry ceiling, expiry) is set to the same number as a limit enforced elsewhere — especially inside a library — read the enforcing comparison instead of assuming it is inclusive. `>` vs `>=` at equal values leaves a one-value dead band that exactly one user action reaches, where the feature silently stops working while surrounding UI still claims it. Docs often say "min" and mean "strictly greater than".
- **Stated query parameters.** When the UI draws, labels, or narrates a parameter the response does not carry (search radius, time window, sample size, score cut-off, cohort), trace it to the producer's actual constant rather than trusting a client-side number or a comment asserting "the convention is X". Producers routinely use tiered or configurable values, so a single hard-coded one gives the visual a false meaning: legitimate results land outside the drawn boundary while other queries stop well inside it. Mirror the producer's values with a test pinning them, or relabel the element as a reference rather than the boundary.
- **Claims the data doesn't back.** Confirm the consumer reads a response's trust qualifiers (`resolved`, `partial`, `approximate`, `stale_at`, `truncated`), and that empty/error branches carry the caveats the ready branch renders — "none found" becomes the false claim "none exist" when the source reports incomplete coverage.
- **Effects that mutate state outliving them.** When an effect sets something shared — a view/model object, `document.body`, a global store, a subscription's config — tick every mutation in the body off against the cleanup. The recurring miss is undoing what was *added* (a layer, a listener) while leaving what was *set* (a bound, a class, a flag), because the added thing is visibly owned and the set thing reads as configuration. Worst when the mutated value carries a documented invariant: the next consumer inherits a state that invariant calls impossible. (A map effect relaxed the view's zoom floor to frame a wide ring, removed the ring on cleanup, and left the floor — so other sections rendered below where their own tile layers draw, legend still listing them.)
- **Bucket headings that borrow the boundary's qualifier.** When results are grouped into buckets derived from a query parameter (tiers, radii, time windows, price bands), a heading may state its boundary but must not attribute that boundary's qualifier to the items inside. Ask it of the *narrowest* bucket: can an item from another stratum land here? Under tiered querying every stratum reaches the innermost bucket. Boundaries describe the query; buckets hold the answer. (Distance bands headed with each ASTM tier's programme put a hazardous-waste site under "Other federal programmes".)
- **Retention without freshness.** Cache retention (`gcTime`, TTL, keep-alive) and freshness (`staleTime`, revalidate, `max-age`) are separate knobs; setting only the first to deliver a "no repeated work" guarantee gives the worst shape — the surface renders instantly from cache and fires the paid call behind it, invisible in the UI *and* in any test asserting the synchronous state. Ask for an assertion on the call count after remount. A sibling paid query usually already sets both, with the reason in a comment.

When a review misses a defect that a later reviewer, another model, or production catches, add its *generalisable* pattern here with a one-line war story. If it doesn't generalise, don't.

**Review the fixes you asked for.** A patch written to close one of your findings is unreviewed code — written fast, on the assumption that you already reasoned it through. You reasoned about the defect, not the patch. Re-read fix commits with the same eyes, hardest where the fix mutates shared state, rewrites user-facing copy, or sets the exact knob the finding named; and check that any test pinning the fix actually fails without it, since a test written alongside a patch tends to encode the patch's assumptions. (Two of three defects a human later found on one PR were introduced by fixes a review pass recommended, each shipped with a green test asserting the wrong thing.)

### Severity levels

1. **🔴 Critical** — Bugs, security vulnerabilities, data loss risks, or crashes. Must be fixed.
2. **🟠 Error** — Logic errors, missing error handling, broken edge cases. Very likely to cause problems.
3. **🟡 Warning** — Code smells, performance concerns, potential edge cases, maintainability issues.
4. **🔵 Suggestion** — Better approaches, readability improvements, idiomatic alternatives.
5. **⚪ Nitpick** — Style, naming, formatting, minor preferences. Totally optional.

### Output format

Group findings by severity. Each severity level that has findings should be its own heading (e.g. `## 🔴 Critical`, `## 🟠 Error`, etc.). Within each severity heading, list the findings. For each finding, include:
- The file and line reference
- A concise description of the issue
- A suggested fix or alternative (when applicable)

Omit severity headings that have no findings.

End with a `## Summary` section: overall assessment, whether changes look good to merge (or code looks healthy), and a count of findings per severity level.

### Delegation

If the agent is not `claude`/`self`/empty, it is treated as a CLI command name. Delegate the review by invoking that command via Bash:
- Build a prompt that includes the review instructions, severity levels, output format, and either the staged diff or the feature description
- Run: `<agent> -q "<prompt>"` where `<agent>` is the CLI command the user specified (e.g. `codex`, `aider`, `goose`)
- When the command returns, relay its findings to the user verbatim
