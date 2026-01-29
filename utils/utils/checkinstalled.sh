#!/bin/bash

# Configuration: Colors and Formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
CHECK_MARK="\xE2\x9C\x94"
CROSS_MARK="\xE2\x9D\x8C"

BREW_PACKAGES="$HOME/dotfiles/brew.packages"
BREW_CASKS="$HOME/dotfiles/brew.casks"

MISSING_PACKAGES=()

# Check formulae
if [ -f "$BREW_PACKAGES" ]; then
	echo -e "=== Formulae === (${YELLOW}$BREW_PACKAGES${NC})\n"

	PACKAGE_LIST=$(cat "$BREW_PACKAGES" | tr '\n' ' ')

	for pkg in $PACKAGE_LIST; do
		if [ -z "$pkg" ]; then continue; fi

		if brew list "$pkg" &>/dev/null; then
			echo -e "${GREEN}${CHECK_MARK} [INSTALLED] ${pkg}${NC}"
		else
			echo -e "${RED}${CROSS_MARK} [MISSING]   ${pkg}${NC}"
			MISSING_PACKAGES+=("$pkg")
		fi
	done
else
	echo -e "${RED}Error: File '$BREW_PACKAGES' not found.${NC}"
fi

echo ""

# Check casks
if [ -f "$BREW_CASKS" ]; then
	echo -e "=== Casks === (${YELLOW}$BREW_CASKS${NC})\n"

	CASK_LIST=$(cat "$BREW_CASKS" | tr '\n' ' ')

	for pkg in $CASK_LIST; do
		if [ -z "$pkg" ]; then continue; fi

		if brew list --cask "$pkg" &>/dev/null; then
			echo -e "${GREEN}${CHECK_MARK} [INSTALLED] ${pkg}${NC}"
		else
			echo -e "${RED}${CROSS_MARK} [MISSING]   ${pkg}${NC}"
			MISSING_PACKAGES+=("$pkg")
		fi
	done
else
	echo -e "${RED}Error: File '$BREW_CASKS' not found.${NC}"
fi

# Summary
echo ""
if [ ${#MISSING_PACKAGES[@]} -gt 0 ]; then
	echo -e "${RED}Missing packages: ${MISSING_PACKAGES[*]}${NC}"
else
	echo -e "${GREEN}All packages are installed!${NC}"
fi
