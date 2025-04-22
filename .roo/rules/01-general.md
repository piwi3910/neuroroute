✨ Code Quality
	•	Keep It Simple
Write clear, concise, and minimal code. Avoid unnecessary complexity.
	•	Write DRY Code (Don’t Repeat Yourself)
Abstract common logic into reusable functions or components.
	•	Follow Naming Conventions
Use descriptive, consistent names for variables, functions, and files.
Example:

// Good
getUserProfile()
// Bad
doStuff()


	•	Prefer Pure Functions
Avoid side effects. Functions should return the same output for the same input.

⸻

📐 Structure & Organization
	•	Use a Logical Project Structure
Group files by feature or function (e.g., components/, services/, utils/).
	•	Modularize Code
Break large files into smaller, focused modules.
	•	Single Responsibility Principle
Each function or class should do one thing only.

⸻

🧪 Testing
	•	Always Write Tests
Unit tests for logic, integration tests for workflows.
	•	Test AI Output
Validate that AI-generated code behaves as intended.
	•	Use TDD When Possible
Write tests before implementation to clarify requirements.

⸻

🧹 Linting & Formatting
	•	Use Linters and Formatters
Enforce style with tools like ESLint, Prettier, Black, or gofmt.
	•	Fix All Errors and Warnings
No code should be checked in with lint or type errors.

⸻

🔐 Security & Safety
	•	Sanitize Inputs
Always validate and sanitize user input to prevent injection attacks.
	•	Avoid Hardcoded Secrets
Use environment variables or secret managers.
	•	Use HTTPS, Escape HTML, Avoid Eval
Be mindful of common vulnerabilities like XSS and code injection.

⸻

🧰 Tooling & Automation
	•	Automate Repetitive Tasks
Use pre-commit hooks, CI/CD, and code generators when appropriate.
	•	Use Strong Typing
TypeScript, Zod, Pydantic, etc., help catch errors early.
	•	Document AI Code Prompts (If Relevant)
For transparency and reproducibility, save generation prompts if useful.

⸻

🗂 Documentation
	•	Comment Clearly and Sparingly
Explain why, not what — the code should show the what.
	•	Write README.md for Each Module
Describe purpose, usage, and important decisions.
	•	Use Docstrings and JSDoc/TypeDoc
Enable automated documentation generation.

⸻

🔄 Version Control
	•	Write Meaningful Commit Messages
Use present tense and describe why the change was made.
	•	Follow Feature/Branch Naming Conventions
Example: feature/user-login, bugfix/token-refresh
	•	Avoid Large Commits
Commit small, logical units of work.

⸻

🤖 AI-Specific Best Practices
	•	Post-process All AI Code
Validate, lint, and test everything before committing.
	•	Never Trust AI Output Blindly
Always review and refactor. AI is a helpful assistant, not a perfect engineer.
	•	Prefer Code Patterns Over One-Off Hacks
Encourage reusable, pattern-based solutions that an AI can apply across projects.