#!/bin/bash

# Brew install with tracking
# Usage: bi <package-name>

if [ -z "$1" ]; then
    echo "Usage: bi <package-name>"
    exit 1
fi

package="$1"
brew_file="$HOME/dotfiles/i.brew.packages"

# Check if already installed
if brew list "$package" &>/dev/null; then
    echo "✓ Package '$package' is already installed"
    exit 0
fi

# Check if brew can install it
echo "Checking if '$package' is available in Homebrew..."
if ! brew info "$package" &>/dev/null; then
    echo "✗ Package '$package' not found in Homebrew"
    brew search "$package"
    exit 1
fi

# Show package info
brew info "$package"
echo ""

# Prompt to add to i.brew.packages
echo -n "Add '$package' to i.brew.packages and install? (y/n): "
read -r response

if [[ "$response" =~ ^[Yy]$ ]]; then
    # Install the package
    echo "Installing '$package'..."
    if brew install "$package"; then
        # Add to i.brew.packages if not already there
        if ! grep -q "\b$package\b" "$brew_file"; then
            # Read current content, add package, and write back
            current_content=$(cat "$brew_file")
            echo "${current_content% } $package" > "$brew_file"
            echo "✓ Added '$package' to i.brew.packages"
        fi
        echo "✓ Successfully installed '$package'"
    else
        echo "✗ Failed to install '$package'"
        exit 1
    fi
else
    echo "Installation cancelled"
    exit 0
fi
