---
name: jira-ticket-fetch
description: Fetch and summarize Jira tickets/issues from Atlassian Cloud. Use when the user asks to fetch, read, inspect, summarize, or check a Jira ticket such as FI-1234; when a repository may contain Jira helper scripts; or when Jira credentials are available through .env or environment variables like JIRA_DOMAIN, JIRA_EMAIL, JIRA_TOKEN, JIRA_USER, JIRA_AUTH, JIRA_URL, or JIRA_BASE_URL.
---

# Jira Ticket Fetch

## Workflow

1. Inspect the current repo for existing Jira workflow before reading secrets:
   - Use `rg --files | rg 'jira|JIRA|bash|scripts|\\.env'`.
   - Use `rg -n 'JIRA_|jira|atlassian' docs bash scripts jenkins .github` when those paths exist.
   - Prefer repo-provided read-only commands for issue fetches when they are clear, already documented, and do not require editing files.
2. Do not print credentials. If `.env` must be inspected, first print only matching variable names, for example:

   ```bash
   awk -F= '/^[[:space:]]*(JIRA|ATLASSIAN)_[A-Za-z0-9_]*=/ {gsub(/^[[:space:]]*/, "", $1); print $1}' .env | sort -u
   ```

3. Authenticate with the least surprising local pattern:
   - `JIRA_AUTH` may already be `email:token`.
   - Otherwise combine `JIRA_EMAIL` or `JIRA_USER` with `JIRA_TOKEN`.
   - Use `JIRA_BASE_URL`, `JIRA_URL`, or `JIRA_DOMAIN` for the Atlassian site.
4. Fetch issues through JQL, not direct `GET /issue`, so the result can include `fields: ["*all"]`, `names`, `schema`, `renderedFields`, and `changelog` expansions. For a repo-independent fallback, run this skill's helper:

   ```bash
   python3 ~/.codex/skills/jira-ticket-fetch/scripts/fetch_jira_issue.py FI-1234 --env-file .env
   ```

   The helper uses `POST /rest/api/3/search/jql` with `key = ISSUE_KEY`. It then fills in Jira-paginated related data when needed: full comments, full changelog histories, full worklogs, and one-level parent/subtask/linked issue summaries fetched by JQL. Add `--raw-out /tmp/FI-1234.jira.json` when the full response is useful for later local parsing.
5. Summarize ticket fields that matter: key, URL, summary, status, issue type, priority, assignee, reporter, created/updated timestamps, labels, components, fix versions, sprint/team if present, parent/subtasks/linked issues, development/PR metadata, comment count and notable comments, changelog/status history, worklog/attachment counts, and the plain-text description. Mention any related data that Jira reported as absent.

## Safety

- Never echo `JIRA_TOKEN`, `JIRA_AUTH`, Basic auth headers, or raw `.env` contents.
- Avoid write operations such as transitions, comments, or field updates unless the user explicitly asks for them.
- Treat Jira data as potentially private. Keep final answers concise and do not dump full raw JSON unless asked.

## Helper Script

Use `scripts/fetch_jira_issue.py` when no repo helper exists or when a standalone path is cleaner. It uses Python standard library only, fetches by JQL by default, and prints sanitized JSON with comments and related summaries included.
