---
name: jira-ticket
description: Generates structured Jira tickets for the AI Team. Use when asked to create, draft, or write a Jira ticket. Supports Task and Research ticket types with built-in research phase, documentation requirements, and a conversational refinement flow. Invoke with a one-liner task description.
---

# Jira Ticket Creator — AI Team

Generate well-structured Jira tickets for the AI Team. The AI Team focuses on LLM integrations, prompt engineering, and AI infrastructure — boosting company-wide productivity with AI tools.

## Workflow

Follow these phases strictly. **NEVER generate a ticket on the first response.** Always go through Phase 1 first.

### Phase 1: Intake & Clarification

1. If no task description was provided in `$ARGUMENTS`, ask the user what ticket they'd like to create.
2. Read the one-liner and determine the ticket type:
   - **Task** — Implementation work. Always includes a research phase as a first step.
   - **Research** — Standalone investigation, evaluation, or spike. No implementation expected.
3. **Confirm the ticket type** with the user. Never silently classify — say something like: *"This sounds like a [Task/Research] ticket. Does that feel right?"*
4. **Ask 1–3 clarifying questions** based on what's missing from the one-liner. Tailor questions to the scenario:

   **For tool/feature tasks:**
   - What problem does this solve?
   - Who benefits from this? (which team/role)
   - Any known constraints or dependencies?

   **For tool/technology research:**
   - What specific tool or technology to research?
   - What problem should it solve for the team?
   - Are there known alternatives to compare against?

   **For issue investigation (team issue, product bug, tool problem):**
   - What are the symptoms? When did this start?
   - Who is affected and how critical is the impact?
   - Steps to reproduce or relevant context?
   - Any workarounds currently in place?

   Keep questions concise and relevant. If the one-liner is already detailed, ask fewer questions. If it's vague, ask more. Aim for enough context to write a clear ticket — not an interrogation.

5. Wait for the user's answers before proceeding.

### Phase 2: Research (Web Search)

1. Before drafting the ticket, search the web for relevant information about the topic.
2. This is especially important for Research tickets, but applies to Task tickets too — the research phase items should be grounded in real context.
3. Use web search to:
   - Gather foundational knowledge about tools, technologies, or concepts mentioned in the task
   - Find current best practices, alternatives, or relevant documentation
   - Validate assumptions and add concrete details to the ticket
4. Incorporate the findings into the ticket draft — populate descriptions, research scope, and acceptance criteria with real, accurate information when applicable.
5. If the web search doesn't return useful results for a given topic, skip it and rely on the user's input.

### Phase 3: Draft

1. Generate the ticket using the appropriate template (see below).
2. Use plain text only — no markdown formatting (no bold, no headers, no code blocks for the ticket content itself).
3. Present the full ticket as plain text for easy copy-paste into Jira.
4. After the draft, ask: "Want any changes, or is this ready to go?"

### Phase 4: Refine & Finalize

1. If the user requests changes, apply them and show the updated draft as plain text.
2. Repeat until the user confirms.
3. On confirmation, output the final clean plain text version with a brief note that it's ready to paste into Jira.

## Ticket Templates

### Task

Type: Task

Title: [Clear, concise title — action-oriented]

Description:

This ticket covers [concise description of what needs to be done].

Research phase:
- [ ] [Specific research item relevant to the task]
- [ ] [Another research item if applicable]
- [ ] Document findings before proceeding with implementation

Implementation:
- [ ] [Implementation step 1]
- [ ] [Implementation step 2]
- [ ] [Additional steps as needed]

Acceptance Criteria:
- [ ] Research phase completed and documented
- [ ] [Specific deliverable or outcome]
- [ ] [Another deliverable if applicable]
- [ ] Documentation created in the repository

### Research

Type: Research

Title: [Research] [Clear topic or question being investigated]

Description:

This ticket covers research into [topic]. [1–3 sentences describing what needs to be investigated and what the expected output is.]

Research scope:
- [ ] [Specific question or area to investigate]
- [ ] [Another area if applicable]
- [ ] [Comparison or evaluation criteria if relevant]

Acceptance Criteria:
- [ ] Research documentation created in the repository
- [ ] TL;DR summary shared in AI Team chat
- [ ] 2–5 min demo call conducted with the team

## Documentation Standard

Every ticket that includes documentation as an acceptance criterion must follow this structure in the created doc:

1. **What is it?** — Brief explanation of the subject
2. **Why is it needed?** — The problem it addresses or value it provides
3. **For who is this?** — Target audience (team, role, department)
4. **Example** — Practical usage example or scenario
5. **How it works?** — Technical or functional overview
6. **Do we need this?** — Honest assessment and recommendation

This structure ensures consistent, useful documentation across all AI Team research and deliverables.

## Rules

- **Tone:** Concise, friendly, and professional. Well-structured but not corporate.
- **Perspective:** Descriptive — use "This ticket covers..." not user-story format.
- **No "Why" / context section** in the ticket body.
- **No Technical Approach section** — that's for the researcher/implementer to determine.
- **No labels, tags, or story points.**
- **Research phase is always included** in Task tickets as the first phase.
- **Output format:** Plain text only. No markdown formatting — no bold, no headers, no code fences. Use plain colons, dashes, and checkboxes (`- [ ]`).
- **Keep it scannable:** developers should grasp the ticket in 30 seconds.
- **Web search:** Always search the web for relevant information before drafting the ticket. Use findings to make the ticket concrete and informed.
- When in doubt about scope or complexity, suggest splitting into multiple tickets but default to a single ticket unless the user agrees.
