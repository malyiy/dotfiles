# Dotfiles

Managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Installation

### 1. Install Stow

```sh
brew install stow
```

### 2. Stow Your Dotfiles

From the dotfiles directory, stow individual packages or all at once:

```sh
# Stow individual packages
stow nvim
stow gitconfig
stow zprofile

# Or stow everything at once
stow */
```

## Managing Dotfiles

### Add a New Package

```sh
# Create a new directory with .config structure
mkdir -p myapp/.config/myapp
# Add your config files
cp ~/.config/myapp/config.yml myapp/.config/myapp/
# Stow it
stow myapp
```

### Remove a Package

```sh
# Unstow (removes symlinks)
stow -D nvim
```

### Re-stow After Changes

```sh
# Re-stow to update symlinks
stow -R nvim
```

### Check What Would Be Stowed

```sh
# Dry run (simulation mode)
stow -n -v nvim
```

## Structure

```
dotfiles/
├── gitconfig/
│   └── .gitconfig
├── nvim/
│   └── .config/
│       └── nvim/
│           └── init.lua
├── zprofile/
│   └── .zprofile
├── zed/
│   └── .config/
│       └── zed/
│           ├── settings.json
│           └── keymap.json
└── ...
```

Each package directory mirrors your home directory structure. Stow creates symlinks from `~` to the files in these directories.

## Troubleshooting

### Conflicts with Existing Files

If stow reports conflicts, back up and remove the existing files:

```sh
# Backup
mkdir -p ~/dotfiles-backup
cp ~/.gitconfig ~/dotfiles-backup/

# Remove
rm ~/.gitconfig

# Then stow
stow gitconfig
```

### Adopt Existing Files

Alternatively, use `--adopt` to move existing files into your dotfiles:

```sh
stow --adopt gitconfig
# This moves ~/.gitconfig into dotfiles/gitconfig/.gitconfig
# and creates the symlink
```
