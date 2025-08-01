# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## System Overview

This is a personal dotfiles repository for macOS configuration management using Nix Darwin and Home Manager. The setup provides a declarative configuration approach for system packages, applications, and dotfiles.

## Key Commands

### System Management
- `drebuild` - Rebuild and switch to new nix-darwin configuration (requires sudo)
- `nix-update` - Update nix flake inputs
- `darwin-rebuild switch --flake nix-darwin#malyiy --impure` - Manual rebuild command

### Navigation and File Management
- `l` - Enhanced ls with icons and tree view (level 1)
- `lt` - Enhanced ls with total size
- `ll` / `lll` - Tree view (level 2) without permissions/filesize
- `..` / `...` / `....` - Navigate up directories

### Development Tools
- `v` - Launch neovim
- `lg` - Launch lazygit
- `yrid` - Build React Native for iPhone (custom script)

## Architecture

### Configuration Structure
- **nix-darwin/flake.nix**: Main system configuration with packages and homebrew casks
- **nix-darwin/home.nix**: Home Manager configuration for user-level dotfiles and symlinks
- **zprofile/.zprofile**: Shell environment variables and path configuration
- **phoenix/.phoenix**: Shell aliases and development environment setup

### Package Management
The system uses a hybrid approach:
1. **Nix packages** (system-level): Core development tools, CLI utilities
2. **Homebrew casks**: GUI applications (Zed, Warp, Ollama, Docker)
3. **Home Manager**: Dotfile symlinks and user configuration

### Development Environment
- **Primary Editor**: Zed (configured with Claude Sonnet 4, vim mode, JetBrains keymap)
- **Terminal**: Warp
- **Version Control**: Git with lazygit frontend
- **Languages**: Node.js (nvm), Python 3.11, Java (OpenJDK), Ruby (rbenv)
- **Mobile Development**: Android SDK, iOS deploy tools, React Native utilities

### Dotfile Linking Strategy
Home Manager creates symlinks from the repository to home directory:
- `.config/zed` → `~/dotfiles/zed`
- `.config/lvim` → `~/dotfiles/lvim`
- `.zprofile` → `~/dotfiles/zprofile/.zprofile`
- `.gitconfig` → `~/dotfiles/gitconfig/.gitconfig`
- `.phoenix` → `~/dotfiles/phoenix/.phoenix`

## Environment Setup

### Path Configuration
The system extends PATH with:
- Homebrew binaries (`/opt/homebrew/bin`)
- Local user binaries (`~/.local/bin`)
- Bun runtime (`$BUN_INSTALL/bin`)
- Ruby binaries (`/opt/homebrew/opt/ruby/bin`)
- Android SDK tools (`$ANDROID_HOME/emulator`, `$ANDROID_HOME/platform-tools`)
- OpenJDK (`/opt/homebrew/opt/openjdk/bin`)
- Global npm packages (`~/.npm-global/bin`)

### Runtime Managers
- **Node.js**: nvm (configured in .zprofile)
- **Ruby**: rbenv with auto-initialization
- **Shell navigation**: zoxide for smart directory jumping

### API Configuration
- LM Studio API configured for local AI model serving on port 1234
- React Editor set to Zed for React Native development

## Making Changes

When modifying the system configuration:
1. Edit `nix-darwin/flake.nix` for system packages or homebrew apps
2. Edit `nix-darwin/home.nix` for dotfile symlinks
3. Run `drebuild` to apply changes
4. Configuration changes are version-controlled in git

The system is configured for aarch64-darwin (Apple Silicon) and uses unstable nixpkgs channel for latest packages.