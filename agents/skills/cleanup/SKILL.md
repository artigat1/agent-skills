---
name: cleanup
description: Finish a completed coding task by checking its Linear issues and pull requests, stopping its local environment, and removing its disposable worktree. Use when asked to clean up after finished work, not for general disk pruning.
---

# Cleanup a finished task

Work from the task's disposable worktree. Identify it from the current session or `git worktree list`; never guess a path from an issue number. If the task spans several worktrees, audit each separately. Do not inspect or operate from the primary checkout in a repository whose instructions forbid it.

## Establish what is finished

1. Identify the task's branches, PRs, and Linear issues from the worktree, PR metadata, commit history, and conversation. Follow explicit links first. Search Linear if necessary, but do not substitute a broad parent issue for a task-specific issue or claim an issue exists without evidence.
2. Check every identified PR's current state. Require merge, not merely green checks or approval. If the task needs a deployment or release, verify that separately; a merged PR or successful image build does not prove deployment. Report unresolved review threads or failed required checks if a PR remains open.
3. Fetch each identified Linear issue's current status. When the issue's acceptance criteria are demonstrably met, mark an open task-specific issue Done and verify the new status. Leave unrelated or broader issues alone. If completion is uncertain, report the issue and stop before destructive cleanup. If there is no matching issue, say so rather than creating or closing one silently.
4. Check for uncommitted or untracked work, unpushed commits, open PRs on the branch, and another active or pinned session using the worktree. Preserve any work that is not demonstrably disposable. Report blockers and stop before teardown; never use `--force` to conceal them.

## Tear down only this task's local resources

1. Inventory running services and task-owned auxiliary processes, such as local reverse proxies or port forwards. Verify ownership by command line, working directory, PID, or recorded startup details. Stop only processes this task started; a listening port alone is not proof of ownership.
2. In Orbital project100x, run `just wt-down` from the target worktree. It checks Compose ownership and removes that worktree's containers, volumes, and networks. Use `--rmi` only when deleting the worktree and its built images are clearly task-owned. Never use `--take-over` during routine cleanup. In another repository, use its documented worktree-specific teardown command and inspect the targets before running it. Do not run global Docker prune commands.
3. Verify the task's processes have exited and its Compose project has no containers, volumes, or network left. A failed teardown is a blocker, not a reason to remove the worktree anyway.
4. From outside the target directory, remove the clean worktree with `git worktree remove <exact-path>`, using the worktree's own Git metadata rather than operating from a protected primary checkout. Verify it disappears from `git worktree list`. Do not delete local or remote branch refs unless separately requested.

Repeat safely after an interrupted run: discover what remains, skip already completed steps, and verify the final state. End with the issue and PR links and statuses, the local resources removed, the worktree path, and anything deliberately retained.
