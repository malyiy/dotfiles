#!/bin/bash

# Brew install with tracking via Brewfile
# Usage:
#   bi              - Install all packages from Brewfile
#   bi <package>    - Install a package (auto-detects cask vs formula)
#   bi -f <package> - Force install as formula (skip cask detection)

BREWFILE="$HOME/dotfiles/Brewfile"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Git commit and push changes to Brewfile
git_commit() {
    local msg="$1"
    cd "$HOME/dotfiles" || return 1
    if git diff --quiet -- Brewfile 2>/dev/null && ! git diff --cached --quiet -- Brewfile 2>/dev/null; then
        : # staged but not in diff, ok
    elif git diff --quiet -- Brewfile 2>/dev/null; then
        echo -e "${YELLOW}No changes to commit${NC}"
        return
    fi
    git add Brewfile
    if git commit -m "$msg"; then
        echo -e "${GREEN}✓ Changes committed${NC}"
        echo "Pushing to remote..."
        if git push; then
            echo -e "${GREEN}✓ Pushed to remote${NC}"
        else
            echo -e "${RED}✗ Warning: Failed to push. Push manually.${NC}"
        fi
    else
        echo -e "${RED}✗ Warning: Failed to commit. Commit manually.${NC}"
    fi
}

# Check if a package entry exists in Brewfile
in_brewfile() {
    local pkg="$1"
    grep -qE "^brew \"${pkg}\"$|^cask \"${pkg}\"$" "$BREWFILE" 2>/dev/null
}

# Add entry to Brewfile
add_to_brewfile() {
    local entry="$1"  # 'brew "name"' or 'cask "name"'
    local pkg="$2"

    if in_brewfile "$pkg"; then
        echo -e "${GREEN}✓ '$pkg' is already tracked in Brewfile${NC}"
        return 0
    fi

    echo -e "Add ${CYAN}$entry${NC} to Brewfile? (y/n): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # Insert before the section marker (avoids duplicating after every line)
        if [[ "$entry" == cask* ]]; then
            sed -i '' "/^# Cargo/i\\
${entry}
" "$BREWFILE"
        elif [[ "$entry" == brew* ]]; then
            sed -i '' "/^# Casks/i\\
${entry}
" "$BREWFILE"
        fi
        echo -e "${GREEN}✓ Added '$entry' to Brewfile${NC}"
        git_commit "Added: $pkg"
    else
        echo "Package installed but not added to Brewfile"
    fi
}

# Install all packages from Brewfile
install_all() {
    echo -e "${CYAN}=== Installing all packages from Brewfile ===${NC}"
    echo ""
    brew bundle install --no-upgrade --file="$BREWFILE"
}

# Install a specific package
install_package() {
    local force_formula=false
    local package

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

    if [[ -z "$package" ]]; then
        echo "Usage: bi <package-name>"
        exit 1
    fi

    # Check if already installed
    if brew list "$package" &>/dev/null || brew list --cask "$package" &>/dev/null; then
        if in_brewfile "$package"; then
            echo -e "${GREEN}✓ '$package' is already installed and tracked in Brewfile${NC}"
            exit 0
        fi
        echo -e "${YELLOW}ℹ '$package' is installed but not tracked in Brewfile${NC}"
        local entry_type="brew"
        if ! $force_formula && brew info --cask "$package" &>/dev/null; then
            entry_type="cask"
        fi
        add_to_brewfile "${entry_type} \"${package}\"" "$package"
        exit 0
    fi

    # Auto-detect cask vs formula
    local is_cask=false
    if [[ "$force_formula" == false ]]; then
        if brew info --cask "$package" &>/dev/null; then
            is_cask=true
        fi
    fi

    # Check availability
    if [[ "$is_cask" == false ]]; then
        if ! brew info "$package" &>/dev/null; then
            echo -e "${RED}✗ Package '$package' not found in Homebrew${NC}"
            brew search "$package"
            exit 1
        fi
    fi

    # Install
    if [[ "$is_cask" == true ]]; then
        brew info --cask "$package"
        echo ""
        echo "Installing '$package' as cask..."
        if brew install --cask "$package"; then
            echo -e "${GREEN}✓ Installed '$package' (cask)${NC}"
            add_to_brewfile "cask \"${package}\"" "$package"
        else
            echo -e "${RED}✗ Failed to install '$package'${NC}"
            exit 1
        fi
    else
        brew info "$package"
        echo ""
        echo "Installing '$package'..."
        if brew install "$package"; then
            echo -e "${GREEN}✓ Installed '$package'${NC}"
            add_to_brewfile "brew \"${package}\"" "$package"
        else
            echo -e "${RED}✗ Failed to install '$package'${NC}"
            exit 1
        fi
    fi
}

# Main
if [ -z "$1" ]; then
    install_all
else
    install_package "$@"
fi
