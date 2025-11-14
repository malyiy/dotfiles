# Dotfiles

Personal macOS dotfiles managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Quick Start

```sh
# Clone and initialize
git clone <repo-url> ~/dotfiles
cd ~/dotfiles
./init.sh
```

The init script installs Homebrew, installs packages from `brew.packages`, creates symlinks with stow, and sets up git hooks.

## Custom Commands

### Package Management

- `bi` - Install all packages from brew.packages
- `bi <package>` - Install package (prompts to add to brew.packages)
- `bd <package>` - Uninstall package (prompts to remove from brew.packages)

### Sync

- `dotsync` - Pull latest, commit changes, and push to remote

### Navigation & Tools

- `l`, `lt`, `ll`, `lll` - Enhanced ls with icons and tree views
- `v` - Launch neovim
- `lg` - Launch lazygit
- `..`, `...`, `....` - Navigate up directories

## Managing Dotfiles

### Stow Packages

```sh
stow nvim           # Stow individual package
stow */             # Stow all packages
stow -D nvim        # Unstow (remove symlinks)
stow -R nvim        # Re-stow after changes
stow -n -v nvim     # Dry run
stow --adopt nvim   # Move existing files into dotfiles
```

### Add New Package

```sh
mkdir -p myapp/.config/myapp
# Add config files
stow myapp
```

## Structure

```
dotfiles/
├── gitconfig/      # Git config with delta diff viewer
├── nvim/           # Neovim LazyVim config
├── phoenix/        # Shell aliases (.phoenix)
├── zed/            # Zed editor settings
├── zprofile/       # Shell environment (.zprofile)
├── utils/          # Custom utility scripts (bi, bd, dotsync)
├── brew.packages   # Tracked Homebrew packages
└── init.sh         # Initialization script
```
