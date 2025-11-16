#!/bin/bash

# Brew uninstall with tracking
# Usage: bd <package-name>

if [ -z "$1" ]; then
    echo "Usage: bd <package-name>"
    exit 1
fi

package="$1"
brew_file="$HOME/dotfiles/brew.packages"

# Check if package is installed
if ! brew list "$package" &>/dev/null && ! brew list --cask "$package" &>/dev/null; then
    echo "✗ Package '$package' is not installed"
    exit 1
fi

# Show package info
echo "Package '$package' is currently installed"
brew info "$package" 2>/dev/null || brew info --cask "$package" 2>/dev/null
echo ""

# Uninstall the package
echo "Uninstalling '$package'..."
if brew uninstall "$package" 2>/dev/null || brew uninstall --cask "$package" 2>/dev/null; then
    echo "✓ Successfully uninstalled '$package'"
    echo ""

    # Check if package is in brew.packages and prompt to remove
    if grep -q "\b$package\b" "$brew_file"; then
        echo -n "Remove '$package' from brew.packages? (y/n): "
        read -r response

        if [[ "$response" =~ ^[Yy]$ ]]; then
            # Remove the package from the file
            current_content=$(cat "$brew_file")
            # Use sed to remove the package (handles spaces correctly)
            new_content=$(echo "$current_content" | sed "s/\b$package\b//g" | sed 's/  */ /g' | sed 's/^ //;s/ $//')
            echo "$new_content" > "$brew_file"
            echo "✓ Removed '$package' from brew.packages"

            # Commit and push changes
            echo ""
            echo "Committing changes to git..."
            cd "$HOME/dotfiles" || exit 1
            git add brew.packages
            if git commit -m "Removed from brew.packages: ${package}"; then
                echo "✓ Changes committed"
                echo "Pushing to remote..."
                if git push; then
                    echo "✓ Successfully pushed to remote"
                else
                    echo "✗ Warning: Failed to push. You may need to push manually."
                fi
            else
                echo "✗ Warning: Failed to commit. You may need to commit manually."
            fi
        else
            echo "Package removed from system but kept in brew.packages"
        fi
    else
        echo "ℹ Package '$package' was not tracked in brew.packages"
    fi
else
    echo "✗ Failed to uninstall '$package'"
    exit 1
fi
