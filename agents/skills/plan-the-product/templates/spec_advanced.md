# [Product Name] — Specification

<!-- Source: https://github.com/unlearndev/spec-templates (spec_advanced_template.md) -->

------

## Overview

[comment here: A short plain-English description of what the product is, what problem it solves, and who it is for. Should be readable by anyone — technical or not. 2–4 sentences.]

------

## Background & Problem Statement

[comment here: Why does this product need to exist? Describe the current situation and the pain or inefficiency it addresses. Include relevant context about how things work today — this helps everyone understand the motivation behind decisions made later in the spec.]

------

## Goals

[comment here: The outcomes the product should achieve. Written as customer or business benefits, not features. Answers the question "why are we building this?" Use bullet points, each starting with a verb.]

------

## Non-Goals

[comment here: What this product is explicitly NOT trying to do. Just as important as goals — helps prevent scope creep and sets expectations early. Be specific. Use bullet points.]

------

## User Roles

[comment here: Who uses the product and what they can do. One subsection per role. Each role should describe permissions and capabilities in plain language — not implementation details. Include both external (customer-facing) and internal (team-facing) roles, and unauthenticated guests if relevant.]

### [Role Name]

- [What this role can do]
- [What this role can see]
- [Any restrictions or limitations specific to this role]

------

## User Stories

[comment here: Optional but useful for larger projects. A concise list of "As a [role], I want to [action] so that [outcome]" statements. These should map directly to the features below and keep the team focused on user value rather than implementation.]

- As a [guest], I want to [browse the idea board] so that [I can see what others have suggested before signing up]
- As a [customer], I want to [submit an idea] so that [I can share feedback with the team]
- As a [team member], I want to [update the status of an idea] so that [customers know what we are working on]

------

## Core Features

[comment here: The main features of the product, one subsection per feature. Each feature should describe what it does and how it behaves from the user's perspective. No technical implementation details — focus on what the user experiences.]

### 1. [Feature Name]

[comment here: 2–4 sentences describing what this feature does, who uses it, and what the key behaviours are. Include any important rules or constraints specific to this feature.]

------

## User Flows

[comment here: Step-by-step descriptions of how a user moves through the product to complete a key task. Cover the most important journeys — not every possible path. Useful for aligning designers and engineers on expected behaviour before building.]

### [Flow Name]

1. [Step one]
2. [Step two]
3. [Step three]

------

## Notifications & Emails

[comment here: Every email or notification the system sends. For each one include: what triggers it, who receives it, what it contains, and any timing details (e.g. immediate, daily digest). This section is often missed and causes gaps during implementation.]

| Trigger               | Recipient       | Content                               | Timing           |
| --------------------- | --------------- | ------------------------------------- | ---------------- |
| [e.g. Idea submitted] | [e.g. Customer] | [e.g. Confirmation with link to idea] | [e.g. Immediate] |

------

## Error States & Edge Cases

[comment here: How the product behaves when things go wrong or in unusual situations. Include empty states (no data yet), validation failures, permission errors, system errors, and any edge cases called out during planning. Prevents these from being an afterthought.]

------

## Constraints

[comment here: Hard limits and rules the product must operate within. These might be business rules, legal requirements, or deliberate product decisions. Anything explicitly ruled out or bounded should live here.]

------

## Assumptions

[comment here: Things the team is treating as true without having fully validated them. Documenting assumptions makes them visible and easy to revisit if circumstances change. If an assumption turns out to be wrong it should trigger a review of the affected sections.]

------

## Open Questions

[comment here: Unresolved decisions that need an answer before or during build. Include who owns each question and a target date if possible. Remove questions once resolved and update the relevant sections.]

| Question                                                   | Owner  | Due    |
| ---------------------------------------------------------- | ------ | ------ |
| [e.g. Should customers be able to delete their own ideas?] | [Name] | [Date] |

------

## Out of Scope (v1)

[comment here: Features or behaviours explicitly deferred to a later version. Different from Non-Goals — these are things the team wants eventually, just not now. Being explicit here prevents them from creeping into the current build.]

------

## Technical Stack

[comment here: The technologies chosen for this project. List the key decisions only — language, framework, database, styling, authentication etc. No need to list every library or package.]

- **Backend** — [e.g. Laravel]
- **Frontend** — [e.g. Vue.js with Inertia.js]
- **Database** — [e.g. MySQL]
- **Styling** — [e.g. Tailwind CSS]
- **Authentication** — [e.g. Laravel Fortify]

------

## Key Dependencies & Integrations

[comment here: External services, APIs, or systems the product relies on. For each one note what it is used for and any known risks or constraints around it.]

| Service         | Purpose                    | Notes                                 |
| --------------- | -------------------------- | ------------------------------------- |
| [e.g. Postmark] | [e.g. Transactional email] | [e.g. Fallback to SES if unavailable] |

------

## Security & Privacy

[comment here: Security requirements and privacy considerations relevant to the product. Include data handling rules, sensitive data that must not be exposed, and any compliance obligations (e.g. GDPR). Keep it product-level — not an engineering security review.]

------

## Success Metrics

[comment here: How will the team know the product is working? Include measurable indicators of success — usage metrics, business outcomes, or qualitative signals. These should map back to the Goals section.]
