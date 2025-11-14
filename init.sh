#!/bin/bash

set -e  # Exit on error

echo "=== Dotfiles Initialization Script ==="
echo ""

# 1. Check if Homebrew is installed
echo "[1/3] Checking Homebrew installation..."
if command -v brew &> /dev/null; then
    echo "✓ Homebrew is already installed"
    brew --version
else
    echo "✗ Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ $(uname -m) == "arm64" ]]; then
        echo "Adding Homebrew to PATH..."
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi

    echo "✓ Homebrew installed successfully"
fi

echo ""

# 2. Install packages from brew.packages
echo "[2/3] Installing Homebrew packages..."
if [[ ! -f "brew.packages" ]]; then
    echo "✗ Error: brew.packages file not found"
    exit 1
fi

# Read packages from file and install
packages=$(cat brew.packages)
echo "Installing packages: $packages"
echo ""

# Install packages one by one, skipping already installed ones
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
echo ""

# 3. Create symlinks with stow
echo "[3/4] Creating symlinks with stow..."

# Stow all packages at once
stow */

echo "✓ Symlinks created successfully"
echo ""

# 4. Install git hooks
echo "[4/4] Installing git hooks..."

if [[ ! -d ".git" ]]; then
    echo "✗ Not a git repository - skipping git hooks installation"
else
    # Create .git/hooks directory if it doesn't exist
    mkdir -p .git/hooks

    # Copy pre-commit hook and make it executable
    if [[ -f ".githooks/pre-commit" ]]; then
        cp .githooks/pre-commit .git/hooks/pre-commit
        chmod +x .git/hooks/pre-commit
        echo "✓ Pre-commit hook installed successfully"
    else
        echo "✗ Warning: .githooks/pre-commit not found"
    fi
fi

echo ""
echo "=== Initialization Complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart your terminal or run: source ~/.zprofile"
echo "  2. Verify configurations are working"
