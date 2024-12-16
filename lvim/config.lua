-- Read the docs: https://www.lunarvim.org/docs/configuration
-- Example configs: https://github.com/LunarVim/starter.lvim
-- Video Tutorials: https://www.youtube.com/watch?v=sFA9kX-Ud_c&list=PLhoH5vyxr6QqGu0i7tt_XoVK9v-KvZ3m6
-- Forum: https://www.reddit.com/r/lunarvim/
-- Discord: https://discord.com/invite/Xb9B4Ny

lvim.keys.normal_mode["<S-l>"] = "$";
lvim.keys.normal_mode["<S-h>"] = "^";
lvim.keys.normal_mode["<Tab>"] = ":BufferLineCycleNext<CR>"
lvim.keys.normal_mode["<S-Tab>"] = ":BufferLineCyclePrev<CR>"
-- lvim.keys.normal_mode["<leader>x"] = ":BufferKill<CR>"
lvim.keys.insert_mode["jk"] = "<Esc>"
lvim.builtin.which_key.mappings["x"] = {
  ":BufferKill<CR>", "Close buffer"
}
lvim.builtin.which_key.mappings['c'] = {}
