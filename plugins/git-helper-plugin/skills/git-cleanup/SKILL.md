---
description: Identify and suggest branches safe to delete
---

Help clean up stale git branches:

1. Run `git branch -a` to list all branches
2. Run `git branch --merged main` (or master) to find merged branches
3. Check the last commit date for unmerged branches with `git log --format="%ci %D" -1 <branch>`
4. Suggest which branches are safe to delete (merged or inactive for 30+ days)
5. Show the exact `git branch -d` commands to run, but do NOT execute them without confirmation
