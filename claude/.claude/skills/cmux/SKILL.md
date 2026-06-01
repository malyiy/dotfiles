---
name: cmux
description: Drive the cmux app's terminals and browser panes from the CLI, tmux-style — address workspaces/panes/surfaces, send commands, capture output, manage layout. Use whenever the user wants Claude to run something in another cmux pane/window/workspace, read back what a pane printed, manipulate the cmux layout, or automate a browser pane. Triggers on "cmux", "run this in pane/surface/workspace N", "in the other pane", "send to that terminal and read the output", or any tmux-like "go to that window and execute" request when cmux is the multiplexer. ALWAYS verify the installed cmux version's docs before relying on command syntax.
---

# cmux CLI usage

`cmux` is a terminal/workspace app with a scriptable CLI that controls the running app over a Unix socket. Its addressing and command set deliberately mirror tmux, so you can drive other panes the way you drive tmux: open a target, send a command, read the output back.

## STEP 0 (MANDATORY): Verify docs for the INSTALLED version first

Command syntax changes between versions. Before relying on any command below, confirm against the version actually installed — do **not** trust this file or web docs blindly.

1. Get the installed version:
   ```bash
   cmux version          # e.g. "cmux 0.64.10 (90) [fafa50702]"
   ```
2. Treat the **installed CLI itself** as the source of truth (the published docs track `main` and may be ahead of or behind the installed build):
   ```bash
   cmux --help           # full, version-accurate command list + flags
   cmux docs             # list doc topics
   cmux docs api         # API topic: web URL, raw resources, and fetch commands
   cmux capabilities     # JSON list of every method the running app supports
   ```
3. Only if you need canonical prose, fetch the published contract — but reconcile it against `cmux --help`, and prefer the local CLI on any mismatch:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/manaflow-ai/cmux/main/docs/cli-contract.md
   curl -fsSL https://raw.githubusercontent.com/manaflow-ai/cmux/main/skills/cmux/SKILL.md
   ```
4. If a command errors with unknown-flag/unknown-command, re-run `cmux --help` (or `cmux <command> --help`) for that version instead of guessing.

State the version you verified against when it matters, and flag any command you used that differs from this skill.

## Handle model (the addressing system)

Targets are addressed by **refs** (`window:1`, `workspace:2`, `pane:3`, `surface:4`), UUIDs, or indexes. A `surface` is the actual terminal (or browser) inside a `pane`; a `pane` lives in a `workspace`; a `workspace` lives in a `window`.

- `CMUX_WORKSPACE_ID` and `CMUX_SURFACE_ID` are auto-set inside cmux terminals and used as defaults — so inside a cmux pane you often don't need `--workspace`/`--surface` flags. When targeting *another* pane, pass the flag explicitly.
- Inspect the live layout before acting:
  ```bash
  cmux tree [--all]                 # full window → workspace → pane → surface tree
  cmux list-workspaces
  cmux list-panes
  cmux list-pane-surfaces
  cmux identify --json              # who am I / current target ids
  ```

## Core workflow: run a command in another pane and read it back

`send` types literal text and does **not** press Enter (like `tmux send-keys` without `Enter`). Pair it with `send-key Enter`.

```bash
cmux send     --surface surface:2 "yarn test:unit"   # type the command
cmux send-key --surface surface:2 Enter              # execute it
cmux read-screen --surface surface:2 --lines 40      # read visible output
cmux read-screen --surface surface:2 --scrollback    # include scrollback
```

- Commands take time. A single `read-screen` can catch mid-render output — re-read until it settles, or use `cmux wait-for -S <name> [--timeout <s>]` when a signal is available.
- `cmux capture-pane [--scrollback] [--lines N]` is the tmux-compat alias for reading a pane.
- `cmux send-key --surface <ref> <key>` for control keys (e.g. interrupt, arrows). Check `cmux --help` / `cmux docs shortcuts` for the exact key syntax in the installed version.

## Layout management (tmux-equivalents)

```bash
cmux new-workspace [--name <t>] [--cwd <path>] [--command <text>] [--window <ref>]
cmux new-pane   [--type terminal|browser] [--direction left|right|up|down]
cmux new-split  <left|right|up|down> [--surface <ref>]
cmux focus-pane --pane <ref>      ;  cmux focus-window --window <ref>
cmux select-workspace --workspace <ref>
cmux resize-pane --pane <ref> (-L|-R|-U|-D) [--amount N]
cmux swap-pane / break-pane / join-pane / next-window / previous-window / last-pane
cmux respawn-pane [--surface <ref>] [--command <cmd>]
cmux close-surface / close-workspace / close-window
```

There is a dedicated **"tmux compatibility commands"** section in `cmux --help` (capture-pane, resize-pane, pipe-pane, wait-for, swap-pane, break-pane, join-pane, find-window, set-hook, set-buffer/paste-buffer, respawn-pane, display-message, …). Consult it for the closest analog to a tmux command.

## Browser panes

cmux panes can be browsers, driven Playwright-style:
```bash
cmux browser open <url>
cmux browser snapshot [-i]        # interactive accessibility snapshot
cmux browser click|fill|type|press <selector> [text]
cmux browser eval <script>
cmux browser get <url|title|text|html|value> [...]
```
See `cmux docs browser` for the full, version-accurate surface.

## Etiquette

- Confirm before running commands in a pane the user is actively using — it may have a long-running process or unsaved state. A fresh/idle pane is safe.
- Keep the conversation pane separate from work panes (run task commands in another surface, report back in the current one).
- Report the real captured output, including errors, rather than assuming success.
