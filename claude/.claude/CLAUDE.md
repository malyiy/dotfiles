# Global Claude Code Instructions

## Quick Reference

- **Rules**: [CLAUDE_RULES.md](./CLAUDE_RULES.md) - Hard rules that must always be followed
@CLAUDE_RULES
- **Style**: [CLAUDE_STYLE.md](./CLAUDE_STYLE.md) - Code style and formatting preferences
@CLAUDE_STYLE
- **Workflow**: [CLAUDE_WORKFLOW.md](./CLAUDE_WORKFLOW.md) - Git, testing, and communication preferences
@CLAUDE_WORKFLOW

## Environment

- **OS**: macOS
- **Editor**: Zed
- **Terminal**: Warp (zsh)
- **Package Manager**: yarn
- **Primary Languages**: JavaScript/TypeScript, Rust, Python, Swift, Kotlin
- **Primary Focus**: Mobile development (React Native)

## Project Tracking

All plans, progress, and notes must be stored in `{project_root}/personal/` directory:

```
personal/
  {feature-name}/
    PLAN.md
    PROGRESS.md
    NOTES.md
  DONE.md
```

This directory should be gitignored. Create it if it doesn't exist.

## Core Principles

1. **Ask for clarification** when requirements are ambiguous
2. **Wait for approval** before making commits or significant changes
3. **Explain changes** with appropriate detail based on complexity
4. **Suggest improvements** but don't implement without approval
5. **Show alternatives** with detailed comparisons when relevant
6. **Prioritize runtime performance** across all projects

## Language & Communication

- All communication in English
- All code comments in English
- All commit messages in English
- For all diagrams use mermaid
- Verbosity depends on complexity - be detailed for complex features
