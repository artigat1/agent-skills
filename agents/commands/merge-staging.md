---
description: "Merge origin/staging (or specified ref) into current branch, auto-resolving, and stash/pop uncommitted work"
allowed-tools: Bash(git *)
argument-hint: "[remote/branch (default: origin/staging)]"
---

# Goal  
Fetch latest from remote, merge the target branch into my **current branch**, resolve conflicts automatically (preserving my branch work), and ensure any uncommitted changes I had get stashed and then re-applied. Report which steps have been completed as this is executed.

# Preconditions  
- The working tree may have uncommitted changes; we will stash them first  
- The current branch must not be in a detached HEAD state  

# Plan  
1. Detect if there are uncommitted changes  
2. If yes: stash them (keeping index)  
3. Fetch from remote for the specified ref. If the ref doesn't start with `origin/`, then add that.
4. Merge into current branch with `-X ours` (i.e. prefer current branch on conflicts)  
5. Pop the stash to reapply uncommitted work  
6. If pop fails or causes conflicts, use the same merge-bias logic or report summary  
