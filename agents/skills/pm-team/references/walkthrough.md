# The completion walkthrough

Every run that makes several changes a user can see ends with a walkthrough: one page the user (and their team) can play through at their own pace, with a recording of each change and somewhere to leave feedback. A single visible change gets a before-and-after recording on the PR instead. Backend-only work with nothing to show skips both and says so in the Done report.

## Shape

**An intro screen** before the first step:

- One sentence on what was built, and the headline counts (for example: 53 capabilities, 41 match the prototype, 12 partly built).
- A legend for the status labels used.
- When each set of recordings was made, and from which PR.
- A Start button.

**One step per change**, in priority order (usage order for a port). Each step has:

- **A title naming the user action**, written in the user's words ("Add a search result to an existing matter"), with a breadcrumb for where it sits in the product.
- **Status chips**: the status label, usage where known (users a month), and a feedback count.
- **Recordings side by side**: before and after for a change, or source and built for a port. Each has its own play control, and one Play both control runs them together. A Show the prototype toggle swaps in the prototype recording when there is one. Each recording has a one-line caption of what it shows.
- **How it compares**: one line, then where it lives (route, how a user gets there), what is missing or different and why, and the build link (PR and branch).
- **Evidence** where it exists: usage figures, the analytics signal behind them, and confidence.
- **A feedback box** that saves what the reader types, and an **Ask about this** box for questions about the capability.

**Navigation**: Previous and Next buttons with the next step's title, arrow keys, a Jump to a step menu, and Esc to close back to wherever the reader opened it from.

## Status labels

Use exactly one per step. Never "partly" without a reason.

| Label | Meaning |
|---|---|
| Matches | The build does what was agreed (prototype, ticket, or acceptance criteria). |
| Deliberate choice | Left out or changed on purpose. Say why. |
| Not built yet | Still to come. Name the follow-up ticket. |
| Done the target's way | The job is done through an existing pattern rather than a copy of the original control. |
| Sample data | No live data source on the test stack, so the clip shows the interaction with staged responses. |
| Couldn't show on the test stack | Built, but the recording stack lacks the data or service to show it. |

## Making the recordings

- Record with the repo's own browser tooling (Playwright video, or what the repo documents). Short clips, 10 to 30 seconds, one user action each.
- Use realistic data, not the happy path: an awkward record (many leases, many sub-assets) shows more than a clean one.
- Put recording on sub-agents and run them in parallel. Recording a real product or production account is outward-facing: get an explicit, scoped yes first.
- Never commit recordings to the repo. They live in the walkthrough, and a few stills go on the PR as before-and-after screenshots.
- After recording, ask the honest question: which steps could not be demonstrated, and why. Each one gets a label above, not a silent gap.

## Publishing

- **Claude Code**: publish it as an Artifact page. Load the `artifact-design` skill first, and the `artifact-capabilities` skill for saved feedback and the Ask box. Upload clips to the artifact's asset store. It is private until the user shares it.
- **Elsewhere**: a single HTML file next to the scratchpad, with the clips beside it.

Link the walkthrough in the PR description and the Linear ticket. Feedback left on it is input for the next round: read it before calling the work done, and turn each actionable item into a fix or a follow-up ticket.
