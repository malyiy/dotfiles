#!/bin/bash

# Dotfiles sync script
# Usage: dotsync
# Pulls latest changes, commits modified files, and pushes to remote

set -e  # Exit on error

# Get the dotfiles directory (where this script is located)
DOTFILES_DIR="$HOME/dotfiles"

# Change to dotfiles directory
cd "$DOTFILES_DIR" || {
    echo "✗ Error: Cannot find dotfiles directory at $DOTFILES_DIR"
    exit 1
}

echo "=== Syncing dotfiles ==="
echo ""

# Pull latest changes
echo "[1/4] Pulling latest changes..."
if git pull; then
    echo "✓ Successfully pulled latest changes"
else
    echo "✗ Failed to pull. Please resolve conflicts manually."
    exit 1
fi
echo ""

# Check for changes
if git diff --quiet && git diff --cached --quiet; then
    echo "✓ No changes to commit"
    echo ""
    echo "=== Sync complete ==="
    exit 0
fi

# Stage all changes
git add -A

# Get list of modified files
echo "[2/4] Changes to be committed:"
echo ""
git status --short
echo ""

# Show detailed changes
echo "Detailed changes:"
echo ""
git diff --cached --stat
echo ""

# Prompt user for confirmation
echo -n "Commit and push these changes? (y/n): "
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Sync cancelled"
    git reset  # Unstage changes
    exit 0
fi
echo ""

# Get list of modified files for commit message
echo "[3/4] Preparing commit..."
modified_files=$(git diff --name-only --cached)

# Build commit message
file_count=$(echo "$modified_files" | wc -l | tr -d ' ')
if [ "$file_count" -le 5 ]; then
    # List all files
    commit_msg="Update: $(echo "$modified_files" | tr '\n' ', ' | sed 's/, $//')"
else
    # List first 5 files and add "and more"
    first_five=$(echo "$modified_files" | head -n 5 | tr '\n' ', ' | sed 's/, $//')
    commit_msg="Update: ${first_five}, and more"
fi

echo "Commit message: $commit_msg"
echo ""

# Commit changes
if git commit -m "$commit_msg"; then
    echo "✓ Changes committed"
else
    echo "✗ Failed to commit changes"
    exit 1
fi
echo ""

# Push to remote
echo "[4/4] Pushing to remote..."
if git push; then
    echo "✓ Successfully pushed to remote"
else
    echo "✗ Failed to push. You may need to pull again."
    exit 1
fi

echo ""
echo "=== Sync complete ==="
