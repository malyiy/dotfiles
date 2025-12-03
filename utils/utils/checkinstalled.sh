#!/bin/bash

# Configuration: Colors and Formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color
CHECK_MARK="\xE2\x9C\x94"
CROSS_MARK="\xE2\x9D\x8C"

BREW_PACKAGES="$HOME/dotfiles/brew.packages"

# Check if file exists
if [ ! -f "$BREW_PACKAGES" ]; then
	echo -e "${RED}Error: File '$BREW_PACKAGES' not found.${NC}"
	exit 1
fi

echo -e "Checking Homebrew packages from: ${YELLOW}$BREW_PACKAGES${NC}\n"

# 3. Read the file
# We use 'cat' and 'tr' to convert newlines to spaces, ensuring
# the loop works even if the list is on one line or multiple lines.
PACKAGE_LIST=$(cat "$BREW_PACKAGES" | tr '\n' ' ')

MISSING_PACKAGES=()

# 4. Loop through each package
for pkg in $PACKAGE_LIST; do
	# Skip empty strings caused by extra spaces
	if [ -z "$pkg" ]; then continue; fi

	# Check if installed (checking both Formulae and Casks)
	if brew list -1 | grep -q "^${pkg}$"; then
		echo -e "${GREEN}${CHECK_MARK} [INSTALLED] ${pkg}${NC}"
	else
		echo -e "${RED}${CROSS_MARK} [MISSING]   ${pkg}${NC}"
		MISSING_PACKAGES+=("$pkg")
	fi
done
