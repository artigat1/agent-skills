# agent-skills

Personal agent skills, commands, and plugin references for AI coding agents
(Claude Code, Codex). The canonical content lives under `agents/`; per-tool
directories (`.claude/`, `.codex/`, `.agents/`) symlink into it so each tool
discovers the same skills from its own conventional path.

## Layout

```
agents/
  skills/     # canonical skills (SKILL.md per skill)
  commands/   # canonical slash commands
  plugins/    # personal plugins (currently none — see Vendor plugins below)
.claude/
  skills   -> ../agents/skills     # Claude Code project-skill discovery
  commands -> ../agents/commands   # Claude Code project-command discovery
.agents/
  skills   -> ../agents/skills     # cross-tool convention; read by Codex
.codex/
  skills   -> ../agents/skills     # Codex project config layer (undocumented but supported)
.claude-plugin/
  plugin.json        # this repo as an installable Claude Code plugin
  marketplace.json   # this repo as a plugin marketplace
```

## Using with Claude Code

**As a project checkout (e.g. cloud routines):** point the routine at this
repository. Claude Code discovers `.claude/skills/` and `.claude/commands/`
automatically from the checkout, so every skill here is available to the
session.

**As a plugin:**

```
/plugin marketplace add artigat1/agent-skills
/plugin install artigat1-skills@artigat1-agent-skills
```

Plugin skills are namespaced (e.g. `/artigat1-skills:triage`).

## Using with Codex

Codex discovers repo-level skills from `.agents/skills/` (the cross-tool
convention) and follows symlinked skill folders, so a checkout of this repo —
local or in Codex cloud — picks up the same canonical skills. Note that Codex
does not support repo-level custom prompts; repo-shareable instructions are
skills only.

## Skills

| Skill | Purpose |
|---|---|
| checklist | Working-through-a-checklist discipline |
| code-review | Code review workflow |
| code-review-unlearn / code-review-triage-unlearn | Unlearn-style code review + triage |
| dual-review | Dual-model (Claude + Codex) PR review panel |
| feature-generator | Generate/sync features.md from spec.md |
| first-five | First-five review heuristic |
| graphify | Turn any input into a persistent knowledge graph |
| implement-a-feature | Guardrailed agent-driven feature implementation |
| llm-wiki | Persistent LLM-built knowledge wiki |
| plan-a-feature | Turn one feature into a build-ready spec |
| plan-the-product | Idea → structured build-ready product spec |
| review-order / review-order-unlearn | Structured review-order heuristics |
| reviewing-ai-written-code | Heuristics for reviewing AI-generated code |
| spec-generator | Vague idea → detailed product specification |
| stacked-prs | Stacked-PR repo conventions and merge semantics |
| supacode-cli | Control Supacode from the terminal |
| triage | Group a diff into feature areas with risk tiers |
| unlearn-code-review | Unlearn code-review method |
| warm | WARM dependency check |
| zombies | ZOMBIES test heuristic |

## Commands

| Command | Purpose |
|---|---|
| merge-staging | Merge origin/staging into the current branch, auto-resolving, stash/pop uncommitted work |

## Vendor plugins

Third-party plugins in use. They are **not** vendored here (licensing +
upstream freshness); install them from their own marketplaces:

| Plugin | Marketplace repo | Install |
|---|---|---|
| caveman | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) | `/plugin marketplace add JuliusBrussee/caveman` then `/plugin install caveman@caveman` |
| agent-skills | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `/plugin marketplace add addyosmani/agent-skills` then `/plugin install agent-skills@addy-agent-skills` |
| cc-amphetamine | [rogeriochaves/cc](https://github.com/rogeriochaves/cc) | `/plugin marketplace add rogeriochaves/cc` then `/plugin install cc-amphetamine@rogeriochaves` |
| frontend-design | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | `/plugin marketplace add anthropics/claude-plugins-official` then `/plugin install frontend-design@claude-plugins-official` |

Skills excluded from this repo because they are copies of third-party sources:
the `caveman*`/`cavecrew` family (from the caveman plugin) and `gh-stack`
(from [github/gh-stack](https://github.com/github/gh-stack)).

## Attribution

Several skills originate from the [unlearn.dev](https://unlearn.dev) AI-coding
course and its [unlearndev/skills](https://github.com/unlearndev/skills)
collection by Alex Garrett-Smith: `checklist`, `code-review`,
`feature-generator`, `first-five`, `implement-a-feature`, `plan-a-feature`,
`plan-the-product`, `review-order`, `reviewing-ai-written-code`,
`spec-generator`, `triage`, `warm`, `zombies`. The `*-unlearn` skills are
personal adaptations of the same methods.
