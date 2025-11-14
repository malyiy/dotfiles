#!/bin/bash

# Brew install with tracking
# Usage:
#   bi              - Install all packages from brew.packages
#   bi <package>    - Install a specific package and add to brew.packages

brew_file="$HOME/dotfiles/brew.packages"

# Function to install all packages
install_all() {
    echo "=== Installing all packages from brew.packages ==="
    echo ""

    if [[ ! -f "$brew_file" ]]; then
        echo "✗ Error: brew.packages file not found at $brew_file"
        exit 1
    fi

    packages=$(cat "$brew_file")
    echo "Packages to install: $packages"
    echo ""

    installed_count=0
    skipped_count=0
    failed_count=0

    for package in $packages; do
        if brew list "$package" &>/dev/null || brew list --cask "$package" &>/dev/null; then
            echo "⊘ Skipping $package (already installed)"
            ((skipped_count++))
        else
            echo "→ Installing $package..."
            if brew install "$package" 2>/dev/null || brew install --cask "$package" 2>/dev/null; then
                echo "✓ Installed $package"
                ((installed_count++))
            else
                echo "✗ Failed to install $package"
                ((failed_count++))
            fi
        fi
    done

    echo ""
    echo "Summary: $installed_count installed, $skipped_count skipped, $failed_count failed"
}

# Function to install a specific package
install_package() {
    package="$1"

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

    # Install the package
    echo "Installing '$package'..."
    if brew install "$package"; then
        echo "✓ Successfully installed '$package'"
        echo ""

        # Check if package is already in brew.packages
        if ! grep -q "\b$package\b" "$brew_file"; then
            # Prompt to add to brew.packages
            echo -n "Add '$package' to brew.packages? (y/n): "
            read -r response

            if [[ "$response" =~ ^[Yy]$ ]]; then
                # Read current content, add package, and write back
                current_content=$(cat "$brew_file")
                echo "${current_content% } $package" > "$brew_file"
                echo "✓ Added '$package' to brew.packages"

                # Commit and push changes
                echo ""
                echo "Committing changes to git..."
                cd "$HOME/dotfiles" || exit 1
                git add brew.packages
                if git commit -m "Added to brew.packages: ${package}"; then
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
                echo "Package installed but not added to brew.packages"
            fi
        else
            echo "ℹ Package '$package' is already tracked in brew.packages"
        fi
    else
        echo "✗ Failed to install '$package'"
        exit 1
    fi
}

# Main logic
if [ -z "$1" ]; then
    install_all
else
    install_package "$1"
fi
