# Claude Code Rules

Hard rules that must always be followed. No exceptions unless explicitly overridden by the user.

## File Access

- **NEVER read `.env` files** - Use `.env.example` instead to understand environment variables
- **NEVER read secrets or credentials** - Only read keys/variable names from `.env.example`
- **NEVER modify lock files** - Do not update `yarn.lock`, `package-lock.json`, etc.

## Code Quality

- **Use `eslint --fix`** for linting issues - Do not manually fix linter errors
- **Do not fix linter issues manually** - Let the tooling handle it
- **Avoid snapshot testing** - Use explicit assertions instead
- **No stack traces in production** - Error messages should be user-friendly in production code

## Dependencies

- **Ask before adding dependencies** - Suggest dependencies but wait for approval before installing
- **Avoid MobX** - Do not introduce MobX in projects that don't already use it
- **Replace deprecated packages** - When encountering deprecated dependencies, suggest newer alternatives
- **Prefer TanStack Query** - For data fetching in new features (not mandatory)

## Project Structure

- **Track work in `personal/` directory** - All plans and progress in `{project_root}/personal/{feature-name}/`
- **Centralize types** - Keep TypeScript types/interfaces in centralized location
- **Centralize constants** - Keep constants in centralized location
- **Centralize utilities** - Keep helper functions in centralized location

## React/React Native

- **Functional components only** - Never use class components
- **Prefer lazy loading** - Use lazy loading where applicable

## Git

- **Never commit automatically** - Always wait for user approval
- **Commit locally only** - Do not push to remote
- **Remind user to create branch** - Prompt user to create a branch before starting work
- **Do not create PRs** - Leave PR creation to the user
- **Do not write PR descriptions** - Leave this to the user

## Communication

- **Ask for clarification** - When requirements are unclear, ask questions
- **Explain disagreements** - If a better approach exists, explain why with options
- **Suggest improvements** - Proactively suggest better solutions but don't implement without approval
- **Do not refactor surrounding code** - Only change what's necessary for the task

## Documentation

- **Update docs when changing code** - Use sub-agent for documentation updates
- **JSDoc for complex functions only** - Don't over-document simple code
- **No README generation** - Don't create README files unless explicitly asked
- **Inline comments only when necessary** - Code should be self-documenting

## Testing

- **Prompt before writing tests** - Ask user before generating tests
- **Test new features only** - Coverage requirements apply to newly created features
- **Do not run tests before committing** - User will handle test execution

## Error Handling

- **Use try/catch** - Standard error handling pattern
- **Use standard Error class** - Custom error classes only for edge cases
- **Verbose errors in development** - Include context in error messages during development
- **Clean errors in production** - No stack traces or sensitive data in production errors
