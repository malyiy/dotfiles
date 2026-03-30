#!/bin/bash

# Brew uninstall with tracking via Brewfile
# Usage: bd <package-name>

BREWFILE="$HOME/dotfiles/Brewfile"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo "Usage: bd <package-name>"
    exit 1
fi

package="$1"

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
    echo -e "${RED}✗ Package '$package' is not installed${NC}"
    exit 1
fi

# Find entry in Brewfile
brewfile_entry=""
if grep -q "^brew \"${package}\"" "$BREWFILE" 2>/dev/null; then
    brewfile_entry="brew \"${package}\""
elif grep -q "^cask \"${package}\"" "$BREWFILE" 2>/dev/null; then
    brewfile_entry="cask \"${package}\""
fi

# Show info
echo "Package '$package' is currently installed"
echo ""

# Uninstall
echo "Uninstalling '$package'..."
if [[ "$is_cask_installed" == true ]]; then
    if ! brew uninstall --cask "$package"; then
        echo -e "${RED}✗ Failed to uninstall '$package'${NC}"
        exit 1
    fi
else
    if ! brew uninstall "$package"; then
        echo -e "${RED}✗ Failed to uninstall '$package'${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Uninstalled '$package'${NC}"
echo ""

# Remove from Brewfile
if [[ -n "$brewfile_entry" ]]; then
    echo -n "Remove '$package' from Brewfile? (y/n): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # Remove the exact line (handles both brew and cask entries)
        sed -i '' "/^$(echo "$brewfile_entry" | sed 's/[\/&]/\\&/g')$/d" "$BREWFILE"
        echo -e "${GREEN}✓ Removed '$package' from Brewfile${NC}"
        echo ""

        # Git commit
        cd "$HOME/dotfiles" || exit 1
        git add Brewfile
        if git commit -m "Removed from Brewfile: ${package}"; then
            echo -e "${GREEN}✓ Changes committed${NC}"
            if git push; then
                echo -e "${GREEN}✓ Pushed to remote${NC}"
            else
                echo -e "${YELLOW}⚠ Failed to push. Push manually.${NC}"
            fi
        fi
    else
        echo "Package removed from system but kept in Brewfile"
    fi
else
    echo -e "${YELLOW}ℹ Package '$package' was not tracked in Brewfile${NC}"
fi
