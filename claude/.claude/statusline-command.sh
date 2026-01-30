#!/bin/bash

# Read JSON input from Claude Code
input=$(cat)

# Parse values from JSON
cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "~"')
model=$(echo "$input" | jq -r '.model.display_name // "Claude"')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
input_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
output_tokens=$(echo "$input" | jq -r '.context_window.total_output_tokens // empty')

# Shorten directory path (last 3 components, replace home with ~)
dir_short=$(echo "$cwd" | sed "s|$HOME|~|" | awk -F'/' '{n=NF; if(n<=3) print $0; else printf "%s/%s/%s", $(n-2), $(n-1), $n}')

# SSH info (only show if in SSH session)
ssh_info=""
if [ -n "$SSH_CONNECTION" ]; then
    user=$(whoami)
    host=$(hostname -s)
    ssh_info="\033[36m${user}@${host}\033[0m:"
fi

# Git info
git_info=""
branch=$(git -c core.fileMode=false symbolic-ref --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
if [ -n "$branch" ]; then
    # Check if repo is dirty
    if git -c core.fileMode=false diff --quiet --ignore-submodules 2>/dev/null && \
       git -c core.fileMode=false diff --cached --quiet --ignore-submodules 2>/dev/null; then
        git_color="\033[32m"  # Green for clean
        status="✔"
    else
        git_color="\033[38;5;208m"  # Orange for dirty
        status="✗"
    fi
    git_info=" ${git_color}${branch} ${status}\033[0m"
fi

# Model color based on type
if echo "$model" | grep -qi "opus"; then
    model_color="\033[31m"  # Red for Opus
elif echo "$model" | grep -qi "sonnet"; then
    model_color="\033[33m"  # Yellow for Sonnet
elif echo "$model" | grep -qi "haiku"; then
    model_color="\033[32m"  # Green for Haiku
else
    model_color="\033[90m"  # Grey for others
fi

# Context usage with color coding
ctx=""
if [ -n "$used" ]; then
    used_int=$(printf "%.0f" "$used" 2>/dev/null || echo "50")
    if [ "$used_int" -gt 80 ] 2>/dev/null; then
        ctx_color="\033[31m"  # Red when high usage
    elif [ "$used_int" -gt 50 ] 2>/dev/null; then
        ctx_color="\033[90m"  # Grey when medium
    else
        ctx_color="\033[32m"  # Green when low usage
    fi

    # Format tokens (convert to k if >= 1000)
    tokens_info=""
    if [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
        if [ "$input_tokens" -ge 1000 ] 2>/dev/null; then
            in_fmt="$(echo "scale=1; $input_tokens/1000" | bc)k"
        else
            in_fmt="$input_tokens"
        fi
        if [ "$output_tokens" -ge 1000 ] 2>/dev/null; then
            out_fmt="$(echo "scale=1; $output_tokens/1000" | bc)k"
        else
            out_fmt="$output_tokens"
        fi
        tokens_info=" ${in_fmt}↓ ${out_fmt}↑"
    fi

    ctx=" ${ctx_color}(${used_int}%%${tokens_info})\033[0m"
fi

# Output the status line
printf "${ssh_info}\033[34m${dir_short}\033[0m${git_info} ${model_color}[${model}]\033[0m${ctx}\n"
