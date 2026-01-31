# Claude Code Workflow

Git workflow, testing, and communication preferences.

## Project Tracking

Before starting any feature work:

1. Create `personal/` directory in project root if it doesn't exist
2. Add `personal/` to `.gitignore` if not already ignored
3. Create feature directory: `personal/{feature-name}/`
4. Create tracking files:
   - `PLAN.md` - Implementation plan and architecture decisions
   - `PROGRESS.md` - Track completed tasks and current status
   - `NOTES.md` - Research, findings, and context

## Git Workflow

### Before Starting Work

- Remind user to create a branch
- Do not create branches automatically

### Branch Naming

When branch contains a ticket number (e.g., `feature/XX-1234-description`):

```
Commit format: XX-1234 | Short clear message
```

When no ticket number:

```
Commit format: Short clear message of what's done
```

### Commits

- **Always wait for user approval** before committing
- Commit locally only - never push
- Keep messages short and clear
- Describe what was done, not how

### Example Commit Messages

```
XX-1234 | Add user authentication flow
XX-1234 | Fix profile image upload
Refactor payment service error handling
Add dark mode toggle to settings
```

### Rebase

- Prefer rebase over merge
- Do not handle merge conflicts automatically - involve user

## Testing

### Framework

- **Jest** for unit and integration tests
- **Detox** for E2E testing (React Native)

### When to Test

- Prompt user before writing tests
- Test coverage for newly created features only
- Do not run tests before committing

### Test Types

- Write both unit and integration tests
- Avoid snapshot testing - use explicit assertions

## Code Review

### Before Submitting Changes

- Do not create PRs automatically
- Do not write PR descriptions
- Let user handle PR creation and review process

### Self-Review Checklist

Before presenting changes to user:
- [ ] Changes are minimal and focused
- [ ] No unnecessary refactoring
- [ ] Error handling is appropriate
- [ ] Types are properly defined
- [ ] Code follows style guide

## Communication

### Asking Questions

- Ask for clarification when requirements are ambiguous
- Don't make assumptions about unclear requirements
- Provide context when asking questions

### Explaining Changes

- Verbosity depends on complexity
- Always explain what was changed
- For complex changes, explain why

### Suggesting Improvements

- Proactively suggest better approaches
- Show alternatives with detailed comparisons
- Wait for approval before implementing suggestions

### Handling Disagreements

When a better approach exists:
1. Explain why the alternative is better
2. Provide concrete examples
3. Offer options to resolve efficiently
4. Respect user's final decision

## Dependencies

### Adding New Dependencies

1. Suggest the dependency with justification
2. Wait for user approval
3. Only then add to package.json

### Updating Dependencies

- Handle updates manually
- Replace deprecated packages with modern alternatives
- Suggest updates but don't auto-apply

## Performance Considerations

Priority order:
1. **Runtime speed** - Primary concern across all projects
2. **Startup time** - Secondary concern
3. **Memory usage** - Consider when relevant
4. **Bundle size** - Project-dependent

## CI/CD

- Jenkins for CI/CD pipelines
- Do not modify CI/CD configuration without approval
