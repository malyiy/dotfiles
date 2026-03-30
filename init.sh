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

# 2. Install packages from Brewfile
echo "[2/3] Installing Homebrew packages from Brewfile..."
if [[ ! -f "Brewfile" ]]; then
    echo "✗ Error: Brewfile not found"
    exit 1
fi

brew bundle install --file=Brewfile

echo ""

# 3. Create symlinks with stow
echo "[3/5] Creating symlinks with stow..."

# Stow all packages at once
stow */

echo "✓ Symlinks created successfully"
echo ""

# 4. Install git hooks
echo "[4/5] Installing git hooks..."

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

# 5. Configure starship prompt
echo "[5/5] Configuring starship prompt..."

STARSHIP_INIT='eval "$(starship init zsh)"'
if grep -qF "$STARSHIP_INIT" ~/.zshrc 2>/dev/null; then
    echo "⊘ Starship already configured in ~/.zshrc"
else
    echo "$STARSHIP_INIT" >> ~/.zshrc
    echo "✓ Starship initialization added to ~/.zshrc"
fi

echo ""
echo "=== Initialization Complete ==="
echo ""
echo "Next steps:"
echo "  1. Restart your terminal or run: source ~/.zprofile"
echo "  2. Verify configurations are working"
