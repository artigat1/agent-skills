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
