#!/usr/bin/env python3
"""Reshape logcli --output=jsonl --include-common-labels stream into the
JSON-array schema the user's downstream tooling expects.

stdin:  one JSON object per line (logcli jsonl format)
stdout: a single JSON array of {line, timestamp, date, fields}

`timestamp` is a nanosecond unix timestamp as a string (matches Loki).
`date`      is UTC ISO 8601 with millisecond precision and a trailing Z.
`fields`    is the full label set (common + per-stream merged by --include-common-labels).
"""
import sys
import json
from datetime import datetime, timezone


def to_ns_and_iso(entry):
    labels = entry.get("labels", {})
    observed = labels.get("observed_timestamp", "")
    if observed.isdigit():
        ns = observed
        dt = datetime.fromtimestamp(int(ns) / 1e9, tz=timezone.utc)
    else:
        dt = datetime.fromisoformat(entry["timestamp"]).astimezone(timezone.utc)
        ns = str(int(dt.timestamp() * 1e9))
    iso = dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"
    return ns, iso


def main():
    out = []
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        e = json.loads(line)
        ns, iso = to_ns_and_iso(e)
        out.append({
            "line": e["line"],
            "timestamp": ns,
            "date": iso,
            "fields": e.get("labels", {}),
        })
    json.dump(out, sys.stdout)
    print(f"reshaped={len(out)}", file=sys.stderr)


if __name__ == "__main__":
    main()
