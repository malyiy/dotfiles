-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

local map = LazyVim.safe_keymap_set

-- Floating Terminal
map("t", "<A-z>", "<cmd>close<cr>", { desc = "Hide Terminal" })

map("n", "<A-z>", function()
  Snacks.terminal(nil, {
    win = {
      width = math.floor(vim.o.columns * 0.9),
      height = math.floor(vim.o.lines * 0.9),
      position = "float",
      border = "rounded",
    },
    cwd = LazyVim.root(),
  })
end, { desc = "Floating Terminal (Root Dir)" })

-- Resize window using <ctrl-shift> arrow keys
map("n", "<C-S-Up>", "<cmd>resize +2<cr>", { desc = "Increase Window Height" })
map("n", "<C-S-Down>", "<cmd>resize -2<cr>", { desc = "Decrease Window Height" })
map("n", "<C-S-Left>", "<cmd>vertical resize -2<cr>", { desc = "Decrease Window Width" })
map("n", "<C-S-Right>", "<cmd>vertical resize +2<cr>", { desc = "Increase Window Width" })
