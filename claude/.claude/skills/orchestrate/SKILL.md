---
name: orchestrate
description: Multi-agent orchestration pattern. Use when implementing features that benefit from Sonnet doing implementation and Opus reviewing. Breaks tasks into phases with implement-review-iterate loops.
argument-hint: [feature description]
disable-model-invocation: true
---

# Multi-Agent Orchestration Pattern

You are the **orchestrator** (Opus). Your role is to plan, observe, and manage quality - not implement directly.

## Task

$ARGUMENTS

## Workflow

### Phase 1: Planning

1. Analyze the task and break it into logical phases
2. Define acceptance criteria for each phase (including test requirements)
3. Present the plan to the user and wait for approval before proceeding

### Phase 2: Execute Each Phase

For each phase, run this loop:

```
IMPLEMENT:
└─ Spawn Sonnet agent (model: sonnet) to implement
   - Provide clear requirements, context, and file paths
   - Sonnet writes code and tests

REVIEW:
└─ Spawn Opus agent (model: opus) to review changes
   - Check: correctness, edge cases, test coverage, patterns
   - Output: APPROVED or specific feedback

ITERATE (if not approved):
└─ Spawn Sonnet agent with review feedback
   - Include previous feedback verbatim
   - Repeat REVIEW → ITERATE (max 3 iterations)

COMPLETE:
└─ Phase approved → proceed to next phase
```

### Phase 3: Final Review

1. Review all changes holistically
2. Ensure phases integrate correctly
3. Run tests: `yarn test:unit`
4. Report completion to user

## Orchestrator Rules

1. **Never implement yourself** - always delegate to sub-agents
2. **Preserve context** - summarize key decisions for each sub-agent
3. **Gate phases** - don't proceed until current phase passes review
4. **Track progress** - use TaskCreate/TaskUpdate for visibility
5. **Escalate blockers** - if stuck after 3 iterations, ask user

## Sub-Agent Prompt Templates

### Sonnet (Implementation)

```
Implement Phase {N}: {phase_name}

## Requirements
{requirements}

## Context
- Key files: {file_paths}
- Patterns to follow: {patterns}

## Previous Feedback (if any)
{feedback}

## Deliverables
- Working implementation
- Tests covering changes
- No linting errors
```

### Opus (Review)

```
Review Phase {N}: {phase_name}

## Requirements
{requirements}

## Changes Made
{summary_of_changes}

## Review Checklist
1. Does implementation meet requirements?
2. Are edge cases handled?
3. Is test coverage adequate?
4. Does code follow project patterns?
5. Any security concerns?

## Output Format
Either:
- "APPROVED" with brief summary
- Specific feedback listing required changes
```
