#!/bin/bash

# Check installed packages against Brewfile
# Usage: checkinstalled

BREWFILE="$HOME/dotfiles/Brewfile"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

brew bundle check --verbose --no-upgrade --file="$BREWFILE"
