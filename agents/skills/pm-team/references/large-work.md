# Large work: ports and multi-feature builds

Load this when the work is a port of functionality from another product or repo, or a build that spans several features. It adds discovery stages before the roster and a proof stage after review. Small work skips this file.

The idea: never write a spec. Each stage ends with an artifact, and the artifacts become the spec. The user can look at any of them and react whenever they want; that reaction is steering, not a gate.

Run the stages in order without stopping. At the end of each one, publish the artifact, post its link in one line, and start the next stage. Make the calls a stage needs yourself and record them in Decisions. When the user's feedback arrives, apply it to the remaining work and to rework of anything already built.

## Stage 1: Understand

Answer, from reading both codebases: what does the source have, and what is its equivalent in the target? Sort every capability into **equivalent**, **close but different**, or **missing**. Output a plain answer and a gap list, not a plan.

Use a read-only investigator for each codebase if they are large. Keep the main thread for the comparison.

## Stage 2: Map it, with evidence

Build a visual artifact of the source's feature surface that the user can click through (on Claude Code, an Artifact page; elsewhere, an HTML file).

- **Only what is live.** Drop anything behind a feature flag that is off in production. Porting dead features is the most expensive mistake available.
- **Colour by real usage.** Pull usage from whichever analytics tool is connected (Heap, PostHog, Amplitude, Datadog RUM). Usage ranks the work: build order follows it, so stopping halfway leaves the most-used features done.
- **Show, do not describe.** Where the source can be run, record short clips of each capability and attach them. A 20-second clip settles what a paragraph cannot, and becomes the yardstick for the built version in Stage 6.

Put the data pulls and recordings on sub-agents so the main thread stays small. Recording or signing into a real product is outward-facing and needs an explicit, scoped yes. Include it in the single up-front request for approvals.

## Stage 3: Decide and prototype

For each capability worth keeping, decide where it lives in the target.

- **Where the target already has it, say so and skip it.** Make this call yourself and record each skip in Decisions.
- **Read the decisions already made.** Find the meeting notes, Slack threads, and tickets where the team discussed this with whatever tools are connected, and read them. Ask the user for them only if you find nothing.
- **For the rest, build a click-through prototype in the real target frontend, not a mock.** Placement problems show up now, not in review. Record each prototype and add it to the Stage 2 artifact with a feedback box per capability.

The prototypes are the scope. Feedback on them that arrives later adjusts it.

## Stage 4: Check the environment

Do this before any builder starts. Skipping it was the costliest mistake in the run this file is drawn from.

1. List every credential, external service, API key, and seed dataset the work needs to run end to end locally. Check each one is present and live. Fix what you can. A missing credential only the user can supply is one of the few things worth stopping for: ask for all of them in one message.
2. Smoke-test the stack itself: the core user path completes (for an agent product, one chat turn completes and one document indexes), and background workers are running.
3. Set the gating scope and record it in Decisions: gate only what is new. Gating something the target already ships switches it off in production until roles exist.

Builders that start on a broken stack test against sample data and report green.

## Stage 5: Build against acceptance criteria

This is the normal Step 1 to Step 5 flow, with three differences.

- **Units come from the prototypes, in usage order.** Point every brief at the artifact as the source of truth instead of re-describing the feature.
- **Every brief carries the same standing criteria.** Set them from the repo's own rules, state them in the roster message, and record them in Decisions. Typical ones for an agent product:
  - The agent can use the feature as well as a user can.
  - The agent can read the feature's underlying data.
  - The feature is toggled per user by role.
  - No new agent tools: options on existing commands, procedure in skills.

  Each one forces a design decision up front that would otherwise surface in review. The criteria say what good looks like. The repo's own AGENTS.md or CLAUDE.md says how to build, so briefs do not prescribe architecture.
- **Validate business rules against the source's backend.** Prototypes show the flow, not the rules (limits, pricing, edge cases). Builders read the source implementation. When they find a source bug, they record it in the scratchpad. You decide whether to port the behaviour (usually not), record it in Decisions, and list it in the Done report.

Also:

- **One PR, do not merge**, unless the user splits it. Merging deploys, so a human makes that call.
- **Merge the base branch daily.** On a multi-day run the base moves and adds checks the branch then fails.
- **Set a standing goal for the run** where the host supports one (Claude Code `/goal`), so the work continues across context resets until the criteria are met.
- **Decisions override briefs and prototypes.** Every worker reads the scratchpad's Decisions section before starting. A ruling made mid-run (for example, "skills, not tools") applies to every later unit and to rework of earlier ones.

## Stage 6: Prove it

Unit tests passing is not done.

1. **Parallel smoke testers against the real UI and API**, each comparing the built feature to its prototype and recording findings in the scratchpad. Testers report; separate fixers fix. Testers never write code.
2. **Build the completion walkthrough** as `walkthrough.md` describes, with one step per capability: the source clip next to the built version, the prototype one toggle away, and the Stage 2 usage figures as evidence. Add it to the Stage 2 artifact behind a Play the walkthrough button, so the map and the result live in one place.
3. **Explain every gap.** No capability may be labelled "partly" without a reason. Each one gets a status label from `walkthrough.md`. "Not built yet" gaps become follow-up tickets.

## Steering

Short questions mid-run change the outcome more than the original prompts. Expect them and act on them:

- "Are these skills or tools?" Stop, write the ruling into Decisions, and consolidate what is already built.
- "What will you use each model for?" Show the roster again. The answer becomes a standing rule.
- "Use a sub-agent for that." Move a side task (data pulls, notes) off the main thread.

## Cost

A run like this can have five agents working at once for days. Worth it for a port or a multi-feature build. Overkill for one feature: use the normal flow.
