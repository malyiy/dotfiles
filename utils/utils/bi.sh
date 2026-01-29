#!/bin/bash

# Brew install with tracking
# Usage:
#   bi              - Install all packages from brew.packages and brew.casks
#   bi <package>    - Install a package (auto-detects cask vs formula)
#   bi -f <package> - Force install as formula (skip cask detection)

packages_file="$HOME/dotfiles/brew.packages"
casks_file="$HOME/dotfiles/brew.casks"

# Function to install all packages
install_all() {
    echo "=== Installing all packages ==="
    echo ""

    installed_count=0
    skipped_count=0
    failed_count=0

    # Install formulae
    if [[ -f "$packages_file" ]]; then
        formulae=$(cat "$packages_file")
        echo "--- Formulae ---"
        for package in $formulae; do
            if brew list "$package" &>/dev/null; then
                echo "⊘ Skipping $package (already installed)"
                ((skipped_count++))
            else
                echo "→ Installing $package..."
                if brew install "$package"; then
                    echo "✓ Installed $package"
                    ((installed_count++))
                else
                    echo "✗ Failed to install $package"
                    ((failed_count++))
                fi
            fi
        done
    fi

    echo ""

    # Install casks
    if [[ -f "$casks_file" ]]; then
        casks=$(cat "$casks_file")
        echo "--- Casks ---"
        for package in $casks; do
            if brew list --cask "$package" &>/dev/null; then
                echo "⊘ Skipping $package (already installed)"
                ((skipped_count++))
            else
                echo "→ Installing $package (cask)..."
                if brew install --cask "$package"; then
                    echo "✓ Installed $package"
                    ((installed_count++))
                else
                    echo "✗ Failed to install $package"
                    ((failed_count++))
                fi
            fi
        done
    fi

    echo ""
    echo "Summary: $installed_count installed, $skipped_count skipped, $failed_count failed"
}

# Function to add a package to a tracking file
track_package() {
    local package="$1"
    local file="$2"
    local label="$3"

    # Check if already tracked in this file
    if grep -q "\b$package\b" "$file"; then
        echo "ℹ Package '$package' is already tracked in $label"
        return
    fi

    echo -n "Add '$package' to $label? (y/n): "
    read -r response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        current_content=$(cat "$file")
        echo "${current_content% } $package" > "$file"
        echo "✓ Added '$package' to $label"

        echo ""
        echo "Committing changes to git..."
        cd "$HOME/dotfiles" || exit 1
        git add "$(basename "$file")"
        if git commit -m "Added to $label: ${package}"; then
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
        echo "Package installed but not added to $label"
    fi
}

# Function to install a specific package
install_package() {
    local force_formula=false
    local package

    # Parse flags
    if [[ "$1" == "-f" ]]; then
        force_formula=true
        package="$2"
        if [[ -z "$package" ]]; then
            echo "Usage: bi -f <package-name>"
            exit 1
        fi
    else
        package="$1"
    fi

    # Check if already installed
    if brew list "$package" &>/dev/null || brew list --cask "$package" &>/dev/null; then
        echo "✓ Package '$package' is already installed"
        exit 0
    fi

    # Determine if cask or formula
    local is_cask=false
    if [[ "$force_formula" == false ]]; then
        if brew info --cask "$package" &>/dev/null; then
            is_cask=true
        fi
    fi

    # Check availability
    if [[ "$is_cask" == false ]]; then
        if ! brew info "$package" &>/dev/null; then
            echo "✗ Package '$package' not found in Homebrew"
            brew search "$package"
            exit 1
        fi
    fi

    # Show info and install
    if [[ "$is_cask" == true ]]; then
        brew info --cask "$package"
        echo ""
        echo "Installing '$package' as cask..."
        if brew install --cask "$package"; then
            echo "✓ Successfully installed '$package' (cask)"
            echo ""

            # Remove from the other file if tracked there
            if grep -q "\b$package\b" "$packages_file"; then
                current=$(cat "$packages_file")
                new=$(echo "$current" | sed "s/\b$package\b//g" | sed 's/  */ /g' | sed 's/^ //;s/ $//')
                echo "$new" > "$packages_file"
                echo "ℹ Moved '$package' from brew.packages"
            fi

            track_package "$package" "$casks_file" "brew.casks"
        else
            echo "✗ Failed to install '$package'"
            exit 1
        fi
    else
        brew info "$package"
        echo ""
        echo "Installing '$package'..."
        if brew install "$package"; then
            echo "✓ Successfully installed '$package'"
            echo ""

            # Remove from the other file if tracked there
            if grep -q "\b$package\b" "$casks_file"; then
                current=$(cat "$casks_file")
                new=$(echo "$current" | sed "s/\b$package\b//g" | sed 's/  */ /g' | sed 's/^ //;s/ $//')
                echo "$new" > "$casks_file"
                echo "ℹ Moved '$package' from brew.casks"
            fi

            track_package "$package" "$packages_file" "brew.packages"
        else
            echo "✗ Failed to install '$package'"
            exit 1
        fi
    fi
}

# Main logic
if [ -z "$1" ]; then
    install_all
else
    install_package "$@"
fi
