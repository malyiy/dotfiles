# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

This is a personal dotfiles repository for macOS, managed using GNU Stow for symlink management. The repository contains configuration files for development tools, shell environment, and applications, organized as independent "packages" that can be stowed individually or collectively.

## Key Commands

### Dotfile Management
- `stow <package>` - Create symlinks for a specific package (e.g., `stow nvim`, `stow zed`)
- `stow */` - Stow all packages at once
- `stow -D <package>` - Remove symlinks for a package (unstow)
- `stow -R <package>` - Re-stow a package after making changes
- `stow -n -v <package>` - Dry run to preview what would be stowed
- `stow --adopt <package>` - Move existing files into dotfiles and create symlinks

### Navigation and File Management
- `l` - Enhanced ls with icons and tree view (level 1)
- `lt` - Enhanced ls with total size
- `ll` / `lll` - Tree view (level 2) without permissions/filesize
- `..` / `...` / `....` - Navigate up 1/2/3 directories

### Development Tools
- `v` - Launch neovim
- `lg` - Launch lazygit
- `yrid` - Build React Native for iPhone (custom script in ~/utils/)

## Architecture

### Stow-Based Package Structure

Each top-level directory is a "package" that mirrors the home directory structure:
- **gitconfig/** - Git configuration with delta diff viewer, includes work-specific config
- **nvim/** - Neovim LazyVim configuration
- **phoenix/** - Shell aliases and custom commands (sourced by .zprofile)
- **zed/** - Zed editor settings, keymaps, tasks, snippets, and prompts
- **zprofile/** - Shell environment variables, PATH configuration, runtime managers
- **utils/** - Custom utility scripts

Stow creates symlinks from `~/.config/` to files in these packages (configured via `.stowrc`).

### Important Files
- **.stowrc**: Configures stow to target `~/.config` and ignore certain files
- **phoenix/.phoenix**: Contains all shell aliases (sourced by zprofile/.zprofile:26)
- **zprofile/.zprofile**: Main shell initialization - sets up PATH, loads nvm, rbenv, zoxide
- **brew.packages**: List of Homebrew packages for reference

### Configuration Organization
The repository separates concerns:
1. **phoenix/.phoenix** - Aliases and commands only
2. **zprofile/.zprofile** - Environment variables, PATH setup, tool initialization
3. Individual packages for each tool's configuration

### Development Environment
- **Primary Editor**: Zed
- **Terminal**: Warp
- **Version Control**: Git with lazygit and delta diff viewer
- **Languages**: Node.js (nvm), Ruby (rbenv), Bun
- **Mobile Development**: Android SDK, React Native utilities
- **Git Workflow**: Conditional config for work projects in ~/work_station/work/

## Environment Details

### Shell Initialization Flow
1. `.zprofile` sources `.phoenix` for aliases
2. Homebrew environment loaded first
3. PATH extended with local bins, language runtimes, Android SDK
4. nvm, rbenv, and zoxide initialized

### PATH Extensions (in order)
- Homebrew binaries (`/opt/homebrew/bin`)
- Local user binaries (`~/.local/bin`)
- Bun runtime (`$BUN_INSTALL/bin`)
- Ruby binaries (`/opt/homebrew/opt/ruby/bin`)
- Android SDK (`$ANDROID_HOME/emulator`, `$ANDROID_HOME/platform-tools`)
- OpenJDK (`/opt/homebrew/opt/openjdk/bin`)
- Global npm packages (`~/.npm-global/bin`)

### Runtime Managers
- **Node.js**: nvm (initialized in zprofile/.zprofile:16-18)
- **Ruby**: rbenv (initialized in zprofile/.zprofile:21)
- **Shell navigation**: zoxide (initialized in zprofile/.zprofile:34)

### API Configuration
- LM Studio API: http://127.0.0.1:1234/v1 (for local AI models)
- React Editor: Zed (for React Native development)

## Making Changes

### Adding a New Package
1. Create directory: `mkdir -p <package>/.config/<package>`
2. Add config files to the directory
3. Stow it: `stow <package>`

### Modifying Existing Configs
1. Edit files directly in the package directories
2. Changes are immediately reflected (files are symlinked)
3. For shell changes, reload: `source ~/.zprofile`

### Adding Aliases or Commands
- Edit `phoenix/.phoenix` (not zprofile/.zprofile)
- Reload shell or run: `source ~/.phoenix`

### Deprecated
The `nix-darwin.deprecated/` directory contains old Nix Darwin configuration (no longer in use).