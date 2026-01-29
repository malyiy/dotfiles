#!/bin/bash

# Brew uninstall with tracking
# Usage: bd <package-name>

if [ -z "$1" ]; then
    echo "Usage: bd <package-name>"
    exit 1
fi

package="$1"
packages_file="$HOME/dotfiles/brew.packages"
casks_file="$HOME/dotfiles/brew.casks"

# Determine where it's tracked
in_packages=false
in_casks=false
if grep -q "\b$package\b" "$packages_file" 2>/dev/null; then
    in_packages=true
fi
if grep -q "\b$package\b" "$casks_file" 2>/dev/null; then
    in_casks=true
fi

# Check if package is installed
is_cask_installed=false
is_formula_installed=false
if brew list --cask "$package" &>/dev/null; then
    is_cask_installed=true
fi
if brew list "$package" &>/dev/null; then
    is_formula_installed=true
fi

if [[ "$is_formula_installed" == false && "$is_cask_installed" == false ]]; then
    echo "✗ Package '$package' is not installed"
    exit 1
fi

# Show package info
echo "Package '$package' is currently installed"
if [[ "$is_cask_installed" == true ]]; then
    brew info --cask "$package" 2>/dev/null
else
    brew info "$package" 2>/dev/null
fi
echo ""

# Uninstall
echo "Uninstalling '$package'..."
if [[ "$is_cask_installed" == true ]]; then
    if ! brew uninstall --cask "$package"; then
        echo "✗ Failed to uninstall '$package'"
        exit 1
    fi
elif [[ "$is_formula_installed" == true ]]; then
    if ! brew uninstall "$package"; then
        echo "✗ Failed to uninstall '$package'"
        exit 1
    fi
fi

echo "✓ Successfully uninstalled '$package'"
echo ""

# Remove from tracking file
remove_from_file() {
    local file="$1"
    local label="$2"

    echo -n "Remove '$package' from $label? (y/n): "
    read -r response

    if [[ "$response" =~ ^[Yy]$ ]]; then
        current_content=$(cat "$file")
        new_content=$(echo "$current_content" | sed "s/\b$package\b//g" | sed 's/  */ /g' | sed 's/^ //;s/ $//')
        echo "$new_content" > "$file"
        echo "✓ Removed '$package' from $label"

        echo ""
        echo "Committing changes to git..."
        cd "$HOME/dotfiles" || exit 1
        git add "$(basename "$file")"
        if git commit -m "Removed from $label: ${package}"; then
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
        echo "Package removed from system but kept in $label"
    fi
}

if [[ "$in_casks" == true ]]; then
    remove_from_file "$casks_file" "brew.casks"
elif [[ "$in_packages" == true ]]; then
    remove_from_file "$packages_file" "brew.packages"
else
    echo "ℹ Package '$package' was not tracked in brew.packages or brew.casks"
fi
