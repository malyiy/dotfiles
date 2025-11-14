-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here

local opt = vim.opt

opt.expandtab = false

-- Force mini.icons to use nerd font icons
vim.g.have_nerd_font = true

-- Use login shell for terminal to load shell configs
opt.shell = "/bin/zsh -l"
