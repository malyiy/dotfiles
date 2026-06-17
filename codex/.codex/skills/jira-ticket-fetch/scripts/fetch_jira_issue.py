#!/usr/bin/env python3
"""Fetch Jira Cloud issues via JQL and print sanitized summary JSON."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].strip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key] = value
    return values


def normalize_base_url(value: str | None) -> str:
    if not value:
        raise SystemExit("Missing Jira site. Set JIRA_BASE_URL, JIRA_URL, JIRA_DOMAIN, or pass --domain.")

    base_url = value.strip().rstrip("/")
    if not base_url:
        raise SystemExit("Jira site is empty.")
    if not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"
    return base_url


def make_auth_header(email_or_auth: str, token: str | None = None) -> str:
    raw = email_or_auth if token is None else f"{email_or_auth}:{token}"
    encoded = base64.b64encode(raw.encode("utf-8")).decode("ascii")
    return f"Basic {encoded}"


def request_json(
    url: str,
    auth_header: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    headers = {
        "Accept": "application/json",
        "Authorization": auth_header,
        "User-Agent": "codex-jira-ticket-fetch/1.0",
    }
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode("utf-8")

    request = urllib.request.Request(url, data=data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        message = body
        try:
            parsed = json.loads(body)
            message = "; ".join(parsed.get("errorMessages") or []) or json.dumps(parsed.get("errors") or parsed)
        except json.JSONDecodeError:
            pass
        raise SystemExit(f"Jira request failed with HTTP {exc.code}: {message}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Jira request failed: {exc.reason}") from exc


def with_query(url: str, params: dict[str, Any]) -> str:
    parts = urllib.parse.urlsplit(url)
    existing = dict(urllib.parse.parse_qsl(parts.query, keep_blank_values=True))
    existing.update({key: str(value) for key, value in params.items() if value is not None})
    return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(existing)))


def paginated_values(
    url: str,
    auth_header: str,
    *,
    collection_key: str,
    page_size: int = 100,
) -> list[dict[str, Any]]:
    start_at = 0
    values: list[dict[str, Any]] = []

    while True:
        page = request_json(with_query(url, {"startAt": start_at, "maxResults": page_size}), auth_header)
        page_values = page.get(collection_key) or []
        if not isinstance(page_values, list):
            return values
        values.extend(item for item in page_values if isinstance(item, dict))

        total = int(page.get("total") or len(values))
        if len(values) >= total or not page_values:
            return values
        start_at += len(page_values)


def adf_to_text(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        return "\n".join(filter(None, (adf_to_text(item).strip() for item in node)))
    if not isinstance(node, dict):
        return ""

    node_type = node.get("type")
    if node_type == "text":
        return str(node.get("text", ""))
    if node_type == "hardBreak":
        return "\n"

    attrs = node.get("attrs") if isinstance(node.get("attrs"), dict) else {}
    attr_text = attrs.get("text") or attrs.get("alt")
    content = adf_to_text(node.get("content"))

    if node_type in {"paragraph", "heading", "listItem"}:
        return content.strip()
    if node_type in {"bulletList", "orderedList"}:
        return "\n".join(line for line in content.splitlines() if line.strip())
    if content:
        return content
    return str(attr_text or "")


def compact_text(value: Any) -> str:
    return " ".join(adf_to_text(value).split())


def user_name(value: Any, fallback: str = "") -> str:
    if not isinstance(value, dict):
        return fallback
    return str(value.get("displayName") or value.get("emailAddress") or fallback)


def names(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    for item in values:
        if isinstance(item, dict):
            name = item.get("name") or item.get("value")
            if name:
                result.append(str(name))
        elif item:
            result.append(str(item))
    return result


def sprint_names(values: Any) -> list[str]:
    if not isinstance(values, list):
        return []
    result: list[str] = []
    for item in values:
        if isinstance(item, dict) and item.get("name"):
            result.append(str(item["name"]))
    return result


def issue_ref(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict) or not value.get("key"):
        return None
    fields = value.get("fields") if isinstance(value.get("fields"), dict) else {}
    return {
        "key": value.get("key"),
        "summary": fields.get("summary") or "",
        "status": (fields.get("status") or {}).get("name") if isinstance(fields.get("status"), dict) else "",
        "issueType": (fields.get("issuetype") or {}).get("name")
        if isinstance(fields.get("issuetype"), dict)
        else "",
        "priority": (fields.get("priority") or {}).get("name") if isinstance(fields.get("priority"), dict) else "",
    }


def related_issue_keys(fields: dict[str, Any]) -> list[str]:
    keys: set[str] = set()

    parent = fields.get("parent")
    if isinstance(parent, dict) and parent.get("key"):
        keys.add(str(parent["key"]))

    for subtask in fields.get("subtasks") or []:
        if isinstance(subtask, dict) and subtask.get("key"):
            keys.add(str(subtask["key"]))

    for link in fields.get("issuelinks") or []:
        if not isinstance(link, dict):
            continue
        for side in ("inwardIssue", "outwardIssue"):
            issue = link.get(side)
            if isinstance(issue, dict) and issue.get("key"):
                keys.add(str(issue["key"]))

    return sorted(keys)


def status_history(histories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    for history in histories:
        for item in history.get("items") or []:
            if isinstance(item, dict) and item.get("field") == "status":
                changes.append(
                    {
                        "created": history.get("created") or "",
                        "author": user_name(history.get("author")),
                        "from": item.get("fromString"),
                        "to": item.get("toString"),
                    }
                )
    return changes


def summarize_comments(comments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": comment.get("id") or "",
            "author": user_name(comment.get("author")),
            "created": comment.get("created") or "",
            "updated": comment.get("updated") or "",
            "body": compact_text(comment.get("body")),
        }
        for comment in comments
    ]


def summarize_worklogs(worklogs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": worklog.get("id") or "",
            "author": user_name(worklog.get("author")),
            "created": worklog.get("created") or "",
            "updated": worklog.get("updated") or "",
            "started": worklog.get("started") or "",
            "timeSpent": worklog.get("timeSpent") or "",
            "timeSpentSeconds": worklog.get("timeSpentSeconds") or 0,
            "comment": compact_text(worklog.get("comment")),
        }
        for worklog in worklogs
    ]


def summarize_related_issue(issue: dict[str, Any], base_url: str) -> dict[str, Any]:
    fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
    key = str(issue.get("key") or "")
    return {
        "key": key,
        "url": f"{base_url}/browse/{urllib.parse.quote(key)}" if key else "",
        "summary": fields.get("summary") or "",
        "status": (fields.get("status") or {}).get("name") if isinstance(fields.get("status"), dict) else "",
        "issueType": (fields.get("issuetype") or {}).get("name") if isinstance(fields.get("issuetype"), dict) else "",
        "priority": (fields.get("priority") or {}).get("name") if isinstance(fields.get("priority"), dict) else "",
        "assignee": user_name(fields.get("assignee"), "Unassigned"),
        "labels": fields.get("labels") or [],
    }


def summarize_issue(
    issue: dict[str, Any],
    base_url: str,
    *,
    comments: list[dict[str, Any]],
    changelog_histories: list[dict[str, Any]],
    worklogs: list[dict[str, Any]],
    related_issues: list[dict[str, Any]],
) -> dict[str, Any]:
    fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
    key = str(issue.get("key") or "")
    comment_field = fields.get("comment") if isinstance(fields.get("comment"), dict) else {}
    worklog_field = fields.get("worklog") if isinstance(fields.get("worklog"), dict) else {}
    changelog = issue.get("changelog") if isinstance(issue.get("changelog"), dict) else {}
    team = fields.get("customfield_10001")
    if isinstance(team, dict):
        team_value = team.get("name") or team.get("value") or ""
    else:
        team_value = team or ""

    return {
        "key": key,
        "id": issue.get("id") or "",
        "url": f"{base_url}/browse/{urllib.parse.quote(key)}" if key else "",
        "summary": fields.get("summary") or "",
        "status": (fields.get("status") or {}).get("name") if isinstance(fields.get("status"), dict) else "",
        "issueType": (fields.get("issuetype") or {}).get("name") if isinstance(fields.get("issuetype"), dict) else "",
        "priority": (fields.get("priority") or {}).get("name") if isinstance(fields.get("priority"), dict) else "",
        "assignee": user_name(fields.get("assignee"), "Unassigned"),
        "reporter": user_name(fields.get("reporter")),
        "team": team_value,
        "parent": issue_ref(fields.get("parent")),
        "created": fields.get("created") or "",
        "updated": fields.get("updated") or "",
        "labels": fields.get("labels") or [],
        "components": names(fields.get("components")),
        "fixVersions": names(fields.get("fixVersions")),
        "sprint": sprint_names(fields.get("customfield_10020")),
        "storyPoints": fields.get("customfield_10016"),
        "originalEstimateSeconds": fields.get("timeoriginalestimate"),
        "remainingEstimateSeconds": fields.get("timeestimate"),
        "description": compact_text(fields.get("description")),
        "relatedCounts": {
            "issueLinks": len(fields.get("issuelinks") or []),
            "subtasks": len(fields.get("subtasks") or []),
            "attachments": len(fields.get("attachment") or []),
            "worklogs": worklog_field.get("total") or len(worklogs),
            "watchers": (fields.get("watches") or {}).get("watchCount") if isinstance(fields.get("watches"), dict) else None,
            "votes": (fields.get("votes") or {}).get("votes") if isinstance(fields.get("votes"), dict) else None,
        },
        "comments": {
            "jqlReturned": len(comment_field.get("comments") or []),
            "total": comment_field.get("total") or len(comments),
            "items": summarize_comments(comments),
        },
        "changelog": {
            "jqlReturned": len(changelog.get("histories") or []),
            "total": changelog.get("total") or len(changelog_histories),
            "statusHistory": status_history(changelog_histories),
        },
        "worklogs": summarize_worklogs(worklogs),
        "relatedIssues": [summarize_related_issue(related, base_url) for related in related_issues],
        "development": fields.get("customfield_10000"),
    }


def build_config(args: argparse.Namespace) -> tuple[str, str]:
    file_values = parse_env_file(Path(args.env_file)) if args.env_file else {}
    env = {**file_values, **os.environ}

    base_url = normalize_base_url(
        args.domain or env.get("JIRA_BASE_URL") or env.get("JIRA_URL") or env.get("JIRA_DOMAIN")
    )

    if args.auth:
        return base_url, make_auth_header(args.auth)
    if env.get("JIRA_AUTH"):
        return base_url, make_auth_header(env["JIRA_AUTH"])

    email = args.email or env.get("JIRA_EMAIL") or env.get("JIRA_USER") or env.get("ATLASSIAN_EMAIL")
    token = args.token or env.get("JIRA_TOKEN") or env.get("ATLASSIAN_TOKEN")
    if not email or not token:
        raise SystemExit(
            "Missing Jira credentials. Set JIRA_AUTH or JIRA_EMAIL/JIRA_USER plus JIRA_TOKEN, "
            "or pass --auth/--email/--token."
        )

    return base_url, make_auth_header(email, token)


def search_jql(base_url: str, auth_header: str, payload: dict[str, Any]) -> dict[str, Any]:
    return request_json(f"{base_url}/rest/api/3/search/jql", auth_header, method="POST", payload=payload)


def make_key_jql(issue_key: str) -> str:
    normalized = issue_key.strip().upper()
    if re.fullmatch(r"[A-Z][A-Z0-9]+-\d+", normalized):
        return f"key = {normalized}"
    escaped = normalized.replace('"', '\\"')
    return f'key = "{escaped}"'


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch Jira Cloud issues via JQL and print sanitized JSON.")
    parser.add_argument("issue_key", nargs="?", help="Jira issue key, for example FI-4481")
    parser.add_argument("--jql", help="Explicit JQL. When omitted, uses `key = ISSUE_KEY`.")
    parser.add_argument("--env-file", default=".env", help="Path to .env file. Use an empty string to disable.")
    parser.add_argument("--domain", help="Jira base URL or domain, for example labforty.atlassian.net")
    parser.add_argument("--auth", help="Jira auth in email:token form. Prefer env vars to avoid shell history.")
    parser.add_argument("--email", help="Jira account email.")
    parser.add_argument("--token", help="Jira API token. Prefer env vars to avoid shell history.")
    parser.add_argument("--raw-out", help="Optional path for full raw JQL and supplemental responses.")
    parser.add_argument("--max-results", type=int, default=1, help="JQL search maxResults. Defaults to 1.")
    parser.add_argument("--no-comments", action="store_true", help="Do not fetch full comment pagination.")
    parser.add_argument("--no-related", action="store_true", help="Do not fetch parent/subtask/linked issue summaries.")
    args = parser.parse_args()

    if args.env_file == "":
        args.env_file = None
    if not args.jql and not args.issue_key:
        parser.error("provide ISSUE_KEY or --jql")

    base_url, auth_header = build_config(args)
    jql = args.jql or make_key_jql(str(args.issue_key))
    payload = {
        "jql": jql,
        "maxResults": args.max_results,
        "fields": ["*all"],
        "expand": "names,schema,changelog,renderedFields",
    }
    search = search_jql(base_url, auth_header, payload)
    issues = search.get("issues") or []
    if not issues:
        raise SystemExit(f"No Jira issues matched JQL: {jql}")

    issue = issues[0]
    fields = issue.get("fields") if isinstance(issue.get("fields"), dict) else {}
    key_or_id = issue.get("id") or issue.get("key")

    comments: list[dict[str, Any]]
    comment_field = fields.get("comment") if isinstance(fields.get("comment"), dict) else {}
    embedded_comments = [item for item in (comment_field.get("comments") or []) if isinstance(item, dict)]
    if args.no_comments:
        comments = embedded_comments
    else:
        comments = paginated_values(
            f"{base_url}/rest/api/3/issue/{urllib.parse.quote(str(key_or_id))}/comment",
            auth_header,
            collection_key="comments",
        )

    changelog = issue.get("changelog") if isinstance(issue.get("changelog"), dict) else {}
    changelog_histories = [item for item in (changelog.get("histories") or []) if isinstance(item, dict)]
    if int(changelog.get("total") or len(changelog_histories)) > len(changelog_histories):
        changelog_histories = paginated_values(
            f"{base_url}/rest/api/3/issue/{urllib.parse.quote(str(key_or_id))}/changelog",
            auth_header,
            collection_key="values",
        )

    worklog_field = fields.get("worklog") if isinstance(fields.get("worklog"), dict) else {}
    worklogs = [item for item in (worklog_field.get("worklogs") or []) if isinstance(item, dict)]
    if int(worklog_field.get("total") or len(worklogs)) > len(worklogs):
        worklogs = paginated_values(
            f"{base_url}/rest/api/3/issue/{urllib.parse.quote(str(key_or_id))}/worklog",
            auth_header,
            collection_key="worklogs",
        )

    related_issues: list[dict[str, Any]] = []
    related_keys = related_issue_keys(fields)
    if related_keys and not args.no_related:
        quoted_keys = ",".join(related_keys)
        related_search = search_jql(
            base_url,
            auth_header,
            {
                "jql": f"key in ({quoted_keys})",
                "maxResults": len(related_keys),
                "fields": ["summary", "status", "issuetype", "priority", "assignee", "labels"],
                "expand": "names,schema",
            },
        )
        related_issues = [item for item in (related_search.get("issues") or []) if isinstance(item, dict)]
    else:
        related_search = None

    if args.raw_out:
        raw = {
            "jqlSearch": search,
            "fullComments": comments,
            "changelogHistories": changelog_histories,
            "worklogs": worklogs,
            "relatedSearch": related_search,
        }
        Path(args.raw_out).write_text(json.dumps(raw, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    summary = summarize_issue(
        issue,
        base_url,
        comments=comments,
        changelog_histories=changelog_histories,
        worklogs=worklogs,
        related_issues=related_issues,
    )
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
