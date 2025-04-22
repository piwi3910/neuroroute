These rules ensure your version control process is clean, understandable, and production-ready. AI-generated code must comply with these practices before being committed or pushed.

⸻

🧼 Commit Hygiene
	•	Write clear, concise commit messages
Format:

<type>(scope): short summary

Example:

feat(auth): add JWT middleware for route protection
fix(user): correct password hashing issue


	•	Use the imperative mood
✅ “Add login form”
❌ “Added login form”
	•	Keep commits small and focused
Each commit should do one thing. Don’t mix unrelated changes.
	•	Avoid committing generated code, logs, or .env files
Use .gitignore to exclude unnecessary files.

⸻

🌱 Branching Strategy
	•	Use feature-based branches
Follow naming patterns like:

feature/user-profile
bugfix/token-refresh
hotfix/production-crash
chore/update-deps


	•	Always branch from the correct base
	•	main or release/* for hotfixes
	•	develop or main for new features
	•	Rebase before merging to avoid noise
Use:

git pull --rebase origin main



⸻

🔀 Merging & Pull Requests
	•	Never commit directly to main or release branches
	•	Use Pull Requests (PRs) for all merges
	•	Include a clear description of the changes
	•	Reference issues if applicable (Fixes #123)
	•	Include screenshots or tests if UI/API related
	•	Squash commits when merging if preferred for a clean history

⸻

🧪 Safety Checks Before Pushing
	•	✅ Run all linters and tests
	•	✅ Ensure the app compiles/builds correctly
	•	✅ Check for secrets accidentally committed (git-secrets, truffleHog)
	•	✅ Rebase to resolve merge conflicts locally

⸻

🏷 Tagging & Releases
	•	Use semantic versioning (SemVer) for tagging releases:

git tag v1.2.3 -m "Release v1.2.3: Add new user onboarding"
git push origin v1.2.3


	•	Tag only stable builds. Avoid tagging work-in-progress code.

⸻

👀 Review & Collaboration
	•	Review code before merging, even if AI-generated.
	•	Respond to code review feedback constructively and promptly.
	•	Ask for review when unsure, even as AI — involve a human reviewer if needed.

⸻

🧠 AI Coder Special Rules
	•	Do not auto-generate commit messages blindly
Messages must reflect the intent of the change.
	•	Never commit without running the linter/test suite
	•	Use Git hooks (e.g., Husky) to enforce lint/test before commit
	•	If a file was auto-generated, mention it in the commit message

⸻

🧰 Recommended Tools
	•	CLI Enhancements: git log --oneline --graph, tig, lazygit
	•	Pre-commit hooks: Husky, Lint-Staged
	•	Git protection: Branch protection rules, required reviewers, CI checks
