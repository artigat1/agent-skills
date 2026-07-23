---
name: reviewing-ai-written-code
description: Use when reviewing AI-generated (or unfamiliar) code to catch what linters and tests miss — applies a toolbox of fast heuristics (First Five, structured review order + Claim/Verify/Trace, ZOMBIES, risk triage, side-effect sweep, the five security checks, AI test smells, WARM dependency check) and compounds findings into AI rules + a review guide. Triggers on "review this code/PR/diff", "review AI-written code", "is this code safe", "check this for bugs/security/side effects before merge".
---

# Reviewing AI-Written Code

A repeatable workflow for reviewing AI-generated and human code. AI code looks right — clean
syntax, reasonable names, runs first try — which is exactly what makes it risky. This skill
is a **toolbox of heuristics**, not canned prompts.

Source: Unlearn "Reviewing AI-Written Code" workflow
(<https://app.unlearn.dev/workflows/reviewing-ai-written-code>). Study notes:
`../../lessons/04-reviewing-ai-written-code.md`.

## When to use
Reviewing a diff/PR/branch — your own AI output, a teammate's, or inherited code — before
merge. Scale the toolbox to the risk (see Triage).

## Procedure

### 0. Triage first (60s) — decide where to spend time
- **High risk** (business logic, auth, data mutations, payments, user data) → deep review.
  Spend ~80% of time here.
- **Medium risk** (route handlers, validation, state management) → run the First Five.
- **Low risk** (config, boilerplate, CRUD, styling) → skim for hardcoded secrets / obvious
  errors.
- Bump a file up a tier if it touches money/auth/user data, has complex branching, hits
  external services, or was a large AI generation.

### 1. First Five (before reading any logic, 2–3 min)
Check: **Error handling** (empty catch blocks), **Input boundaries** (empty/null/duplicate/
huge input), **External/API calls** (nonexistent methods, wrong arg order), **State
mutations** (shared data), **Assumed dependencies** (missing files/env vars/helpers).

### 2. Structured review (high-risk code) — read in order, interrogate each block
Order: **Types/interfaces → Data flow → Business logic → Edge cases.**
Per block, **Claim → Verify → Trace**: state what it claims to do; check it does; ask "what
if the input is wrong?" and follow the failure path.

### 3. ZOMBIES — adversarial inputs, then write the failures as real tests
**Z**ero, **O**ne, **M**any, **B**oundaries, **I**nterfaces (data crossing components),
**E**xceptions (handled?), **S**imple (does the happy path work?).

### 4. Side-effect sweep (~5 min)
Search for `write save send delete update emit dispatch mutate push remove create`. For each:
**Intentional?** **Idempotent?** (safe to run twice) **Guarded?** (failure doesn't leave a
broken state).

### 5. Security — five checks per endpoint (<5 min)
Unsanitized user input; overly permissive auth (CORS `*`, missing auth, missing
resource-level check); hardcoded secrets; missing rate limiting; **auth ≠ authorization**
(can a user reach another user's data by changing an ID?).

### 6. Review the tests — green doesn't mean good
Watch for: tautological, happy-path-only, implementation-coupled, snapshot/copy-paste tests.
Ask of each: *What behaviour does this verify? If I broke the feature, would this catch it?
Is this testing the code or the mock?*

### 7. WARM — for every new dependency (<2 min)
**W**orth it (>~20 lines to DIY, else inline) · **A**live (recent commits/releases/maintainer)
· **R**ight-sized (one function from a big lib → copy it) · **M**aintained securely
(`npm audit` / equivalent).

### 8. Reviewing code you didn't write
State the intent in one sentence (can't → red flag). Spot unreviewed-AI signs (generic
names, what-not-why comments, off-pattern code). Ask the author: prompt/intent? modified or
committed as-is? tested against what? Give feedback as **What / Why / How**.

### 9. Compound the review
- Add recurring findings to a **rules file** (`CLAUDE.md` / `.cursorrules`) as generation
  constraints so the AI stops repeating them.
- Keep a short **`REVIEW_GUIDE.md`** of per-area "watch out for…" warnings; remove each once
  structurally fixed.
- Optionally **automate** a baseline review (GitHub Actions: diff → AI API → PR comments, or
  a service like CodeRabbit) as a first filter — not a replacement for human judgement.

### 10. Publish to the PR when a PR was supplied
If the user gave a PR URL/number, or the current branch clearly resolves to one, treat the PR as
the default destination for the review. Post a top-level PR comment with the findings before
finishing; do not make the user ask again. Ask first only if the user requested a private/local
review, the PR target is ambiguous, or the comment would disclose sensitive information.

Post the same high-signal content you would send locally: severity-grouped findings, file:line
references, suggested fixes, open questions, and notable test gaps. If no issues were found,
post a concise "no blocking findings" comment with residual risk/test gaps. After posting, tell
the user where it was posted (comment id or link). If posting fails, report the failure and
include the exact comment body that should be posted.

## Output format for findings
Group by severity (e.g. Critical / Error / Warning / Suggestion / Nitpick), with `file:line`
references and a suggested fix. Default to What / Why / How per item.

## Completion checklist
- [ ] Triaged; First Five run on changed files.
- [ ] High-risk code read in order with Claim→Verify→Trace.
- [ ] ZOMBIES + side-effect sweep + security checks applied where relevant.
- [ ] Tests interrogated; dependencies WARM-checked.
- [ ] Findings captured; recurring ones promoted to rules file / review guide.
- [ ] If a PR was supplied/resolved, review comment posted to the PR (or failure reported with
      the exact comment body).

## Notes
- Vault copy (study/reference). To activate: copy this dir into a project's
  `.claude/skills/` or `~/.claude/skills/`.
- Related course skills: `first-five`, `review-order`, `zombies`, `triage`, `code-review` in
  <https://github.com/unlearndev/skills>.
