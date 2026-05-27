---
name: loki-logs-fetch
description: Pull claude-code telemetry logs (or any Loki stream) from the aimonitor namespace day-by-day via kubectl port-forward + logcli, producing both a raw .jsonl and a reshaped .json array per day. Use this skill whenever the user asks to fetch/download/pull/grab logs from Loki, claude-code telemetry, the aimonitor cluster, or mentions a date range with words like "logs" or "telemetry" — even if they don't explicitly name Loki or logcli. Also trigger when the user references the file naming convention `Logs-YYYY-MM-DD.json` or asks to back-fill missing days.
---

# Loki logs fetch

Pull claude-code telemetry from the `aimonitor` namespace's Loki instance for one or more days. Each day produces two files in the **current working directory**:

- `Logs-YYYY-MM-DD.jsonl` — raw logcli output (`--output=jsonl --include-common-labels`), one JSON object per line, full labels preserved.
- `Logs-YYYY-MM-DD.json` — JSON array reshaped into the schema downstream tooling expects: `{line, timestamp, date, fields}` where `timestamp` is a nanosecond unix string and `date` is a UTC ISO with millisecond precision (`.000Z`).

## When to use this skill

Trigger on phrasings like:
- "fetch loki logs for last week"
- "download claude-code logs from 29.04 till today"
- "pull telemetry for 2026-05-01..2026-05-05"
- "grab the aimonitor logs"
- "I'm missing `Logs-2026-04-30.json`, can you back-fill it?"

If only the filename pattern is mentioned without an explicit "fetch" verb, still consider this skill — the naming convention is a strong signal.

## Inputs to extract from the user

| Input | Default | Notes |
|---|---|---|
| Date range | If absent, ask. Accept `YYYY-MM-DD..YYYY-MM-DD`, `29.04..05.05`, "last N days", or a single date. | Always expand to an explicit list of dates before iterating. |
| Time window | `06:00:00`–`21:59:59` in **+03:00** (EEST) | The user is on macOS in EEST. Keep the offset literal in `--from`/`--to` so DST doesn't bite you. |
| Loki query | `{service_name="claude-code"}` | Override only if the user names a different stream. |

If the user only gives a partial date (`29.04`), assume the current year unless context says otherwise, and confirm if it's ambiguous.

## Workflow

### 1. Preflight

Run these checks once. If any fail, surface the exact problem and stop — don't try to recover silently.

```bash
ls -l ~/.kube/config              # kubeconfig present
which kubectl logcli              # both binaries on PATH
kubectl cluster-info              # cluster reachable
kubectl -n aimonitor get svc loki-gateway  # service exists
```

### 2. Port-forward (background, lifecycle-aware)

Loki isn't exposed externally — we tunnel it. Start a port-forward to `svc/loki-gateway` mapping local `3100` → service `80`. **Do not** restart it if one is already running on this port; just reuse.

```bash
# Probe first — if Loki answers, skip starting a new forward.
if ! curl -sf -o /dev/null --max-time 2 http://localhost:3100/loki/api/v1/labels; then
  kubectl -n aimonitor port-forward svc/loki-gateway 3100:80
  # ↑ run this in the background via the harness's run_in_background mechanism
  # so the caller (and subsequent commands in the loop) can use it.
  # Note the background task ID and report it to the user at the end.
fi
```

Why `loki-gateway:80` and not `loki:3100`? The gateway is the canonical query entrypoint and what the cluster expects external clients to hit; the bare `loki` service skips auth/multitenancy headers the gateway adds.

### 3. Verify connectivity

Before the loop, confirm logcli can actually talk to Loki:

```bash
LOKI_ADDR=http://localhost:3100 logcli labels
```

If this returns no labels or errors out, the port-forward is dead — bail out.

### 4. Per-day fetch loop

For each date in the requested range, run **one** logcli invocation. Use `--parallel-duration=1h --parallel-max-workers=4` to split the day into hour-sized chunks, each well under Loki's server-side query timeout and entry cap. Use `--forward` so output is in chronological order.

Why parallel mode and not `--limit=0 --batch=5000`? In practice the aimonitor Loki instance enforces a ~5-minute query timeout and a 5000-entry hard cap per request. With sequential pagination logcli keeps hitting the timeout — the symptom is "queries take ~5 minutes and return 0 entries" or "exactly 5000 entries on a busy day." Parallel mode pages by *time* instead of *entry count*, so each chunk completes well within limits. `--limit` is ignored in parallel mode, which is what we want anyway.

```bash
export LOKI_ADDR=http://localhost:3100
QUERY='{service_name="claude-code"}'
SKILL_DIR="$HOME/.claude/skills/loki-logs-fetch"

for d in $DATES; do
  jsonl_file="Logs-${d}.jsonl"
  json_file="Logs-${d}.json"

  # Overwrite guard — see "Overwrite policy" below
  if [ -f "$jsonl_file" ] || [ -f "$json_file" ]; then
    : # warn user per "Overwrite policy" below
  fi
  # Don't write an empty placeholder for failed/empty days — better to leave
  # the slot blank than to drop a 0-byte file the user will have to clean up.

  logcli query "$QUERY" \
    --from="${d}T06:00:00+03:00" \
    --to="${d}T21:59:59+03:00" \
    --output=jsonl \
    --include-common-labels \
    --forward \
    --parallel-duration=1h \
    --parallel-max-workers=4 \
    > "$jsonl_file" 2>/dev/null

  raw=$(wc -l < "$jsonl_file" | tr -d ' ')
  if [ "$raw" -eq 0 ]; then
    # No data this day — delete the empty .jsonl (no point keeping a 0-byte file)
    # and skip writing the .json. Move on.
    rm -f "$jsonl_file"
    echo "  $d: 0 entries (skipped)"
    continue
  fi

  python3 "$SKILL_DIR/scripts/reshape.py" < "$jsonl_file" > "$json_file"
  echo "  $d: $raw entries"
done
```

### 5. Report back

When the loop finishes, report a compact table to the user:

```
Date          | jsonl       | json
2026-04-29    |   59,896    |  70M
2026-05-01    |   11,361    |  14M
...
```

Include:
- The background task ID for the port-forward, and that it's still running.
- Any days that were skipped (zero entries).
- Any files that were overwritten.

## Overwrite policy

Files matching the naming convention may already exist from earlier runs or from another tool. Before writing:

1. If neither file exists for a date → write freely.
2. If files exist but are clearly the same window (file size within ~5% of expected and same date) → overwrite without nagging; the user almost certainly wants fresh data.
3. If files exist with a *significantly* different size → ask the user once before continuing. The likely cause is a different time window or query, and silently clobbering destroys their previous work.

State the warning in plain terms: "`Logs-2026-05-04.json` already exists (19M, modified yesterday). The new query will produce a ~31M file. Overwrite?"

## Schema reference (`.json` reshape)

The reshaper script (`scripts/reshape.py`) emits one JSON array per day:

```json
[
  {
    "line": "claude_code.hook_execution_complete",
    "timestamp": "1777896547214000000",
    "date": "2026-05-04T12:09:07.214Z",
    "fields": {
      "service_name": "claude-code",
      "event_name": "hook_execution_complete",
      "observed_timestamp": "1777896547214000000",
      "session_id": "...",
      "...": "..."
    }
  }
]
```

Notes for downstream consumers:
- `timestamp` is a string (nanosecond integers exceed JS `Number.MAX_SAFE_INTEGER`).
- `fields.observed_timestamp` always equals `timestamp` when present.
- `--include-common-labels` is what makes `fields` complete; without it, stream-wide labels (`service_name`, `host_arch`, etc.) are stripped from individual entries.

## Common pitfalls

- **Empty results when window looks reasonable.** Loki's `06:00-21:59 +03:00` is `03:00-18:59 UTC`. Queries that *look* like they should hit traffic but don't are usually a timezone mistake. The `+03:00` literal is intentional — don't convert to `Z` and "simplify".
- **Stale port-forward.** `kubectl port-forward` dies if the pod restarts. If `logcli labels` works at the start but a mid-loop query hangs, restart the forward and re-run the failed day(s).
- **Sequential `--limit=0` silently hangs on this Loki.** The aimonitor instance has a ~5-min server query timeout. Sequential pagination hits it and returns 0 entries (or exactly 5000 on busy days) without erroring. Always use `--parallel-duration=1h --parallel-max-workers=4` for this cluster. `--limit` is ignored in parallel mode, which is fine — time-based chunking is what we want.
- **`--limit=30` (the default) silently truncates.** Irrelevant in parallel mode, but worth knowing if you ever fall back to single-request queries for debugging.
- **JSON array vs JSON Lines.** `Logs-*.json` is a single array (the user's tooling parses it that way); `Logs-*.jsonl` is one object per line. They're not interchangeable — keep both.

## Cleanup

The port-forward stays up so the caller can run follow-up queries. When the user is done, remind them how to kill it (`kill %1`, or whatever the harness's task-stop equivalent is for the recorded background task ID).
