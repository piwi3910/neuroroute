Linting helps maintain clean, consistent, and error-free code. For AI-generated or AI-assisted code, it’s even more crucial to apply strict linting standards to ensure the output is production-ready and human-readable.

✅ General Principles
	•	Automate Everything: Use linting tools as part of your CI/CD pipeline and pre-commit hooks.
	•	Be Consistent: Adopt a single, well-documented coding style for your language or project.
	•	Fail Fast: Treat lint errors as build failures to ensure issues are caught early.

🛠 Recommended Tools by Language

Language	Tool(s)
JavaScript/TS	ESLint, Prettier
Python	flake8, black, isort
Go	golangci-lint, gofmt
Java	Checkstyle, SpotBugs
C/C++	clang-tidy, cpplint
HTML/CSS	stylelint, Prettier
JSON/YAML	yamllint, JSONLint
Shell Scripts	ShellCheck

📋 Best Practices

1. Define and Share Rules
	•	Use shared linting config files (e.g., .eslintrc, .prettierrc, .flake8) stored in version control.
	•	Align rules with your team or project’s style guide.

2. Auto-fix Where Possible
	•	Enable auto-fix on save in editors.
	•	Use CLI auto-fix before pushing code:

eslint . --fix
black .



3. Use Pre-commit Hooks
	•	Tools like Husky, pre-commit, or custom Git hooks can run linters before committing:

- repo: https://github.com/pre-commit/mirrors-eslint
  rev: v8.0.0
  hooks:
    - id: eslint



4. Include Linting in CI/CD
	•	Run linters in GitHub Actions, GitLab CI, or your CI tool of choice.
	•	Example (GitHub Actions):

- name: Run ESLint
  run: npx eslint . --ext .js,.ts



5. Don’t Ignore Warnings
	•	Warnings often reveal potential bugs or bad practices.
	•	Escalate important warnings to errors if needed.

6. Document Exceptions
	•	If a rule must be disabled, add a comment with a reason:

// eslint-disable-next-line no-console -- Used for debug logging in dev only
console.log("Debug info");



7. Combine Formatting & Linting
	•	Pair a formatter (e.g., Prettier) with a linter to avoid redundant rules.
	•	Let Prettier handle style and ESLint focus on logic issues.

🤖 AI-Specific Considerations
	•	AI-generated code should always be linted before being presented to users.
	•	Post-process AI output with a linter and formatter to improve trust and usability.
	•	Train AI on clean codebases that follow strict linting guidelines.
