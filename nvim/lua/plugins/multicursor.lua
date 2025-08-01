return {
  {
    "jake-stewart/multicursor.nvim",
    branch = "1.0",
    config = function()
      local mc = require("multicursor-nvim")
      mc.setup()
      local map = vim.keymap.set

      -- Add or skip cursor above/below the main cursor.
      map({ "n", "x" }, "<up>", function()
        mc.lineAddCursor(-1)
      end, { desc = "(MultiCursor) Add cursor on line above" })

      map({ "n", "x" }, "<down>", function()
        mc.lineAddCursor(1)
      end, { desc = "(MultiCursor) Add cursor on line below" })

      map({ "n", "x" }, "<leader><up>", function()
        mc.lineSkipCursor(-1)
      end, { desc = "(MultiCursor) Skip adding cursor on line above" })

      map({ "n", "x" }, "<leader><down>", function()
        mc.lineSkipCursor(1)
      end, { desc = "(MultiCursor) Skip adding cursor on line below" })

      -- Add or skip adding a new cursor by matching word/selection
      map({ "n", "x" }, "<leader>n", function()
        mc.matchAddCursor(1)
      end, { desc = "(MultiCursor) Add cursor on next matching word/selection" })

      map({ "n", "x" }, "<leader>s", function()
        mc.matchSkipCursor(1)
      end, { desc = "(MultiCursor) Skip next matching word/selection" })

      map({ "n", "x" }, "<leader>N", function()
        mc.matchAddCursor(-1)
      end, { desc = "(MultiCursor) Add cursor on previous matching word/selection" })

      map({ "n", "x" }, "<leader>S", function()
        mc.matchSkipCursor(-1)
      end, { desc = "(MultiCursor) Skip previous matching word/selection" })

      map({ "n", "v" }, "<leader>A", mc.matchAllAddCursors, { desc = "(MultiCursor) Match all selections" })

      -- Add and remove cursors with control + left click.
      map("n", "<c-leftmouse>", mc.handleMouse, { desc = "(MultiCursor) Add/remove cursor with Ctrl+click" })
      map("n", "<c-leftdrag>", mc.handleMouseDrag, { desc = "(MultiCursor) Handle mouse drag for multicursor" })
      map(
        "n",
        "<c-leftrelease>",
        mc.handleMouseRelease,
        { desc = "(MultiCursor) Handle mouse release for multicursor" }
      )

      -- Disable and enable cursors.
      map({ "n", "x" }, "<c-q>", mc.toggleCursor, { desc = "(MultiCursor) Toggle cursor enable/disable" })

      -- Mappings defined in a keymap layer only apply when there are
      -- multiple cursors. This lets you have overlapping mappings.
      mc.addKeymapLayer(function(layerSet)
        -- Select a different cursor as the main one.
        layerSet({ "n", "x" }, "<left>", mc.prevCursor, { desc = "(MultiCursor) Switch to previous cursor" })
        layerSet({ "n", "x" }, "<right>", mc.nextCursor, { desc = "(MultiCursor) Switch to next cursor" })

        -- Delete the main cursor.
        layerSet({ "n", "x" }, "<leader>x", mc.deleteCursor, { desc = "(MultiCursor) Delete current cursor" })

        -- Enable and clear cursors using escape.
        layerSet("n", "<esc>", function()
          if not mc.cursorsEnabled() then
            mc.enableCursors()
          else
            mc.clearCursors()
          end
        end, { desc = "(MultiCursor) Enable cursors or clear all cursors" })
      end)

      -- Customize how cursors look.
      local hl = vim.api.nvim_set_hl
      hl(0, "MultiCursorCursor", { reverse = true })
      hl(0, "MultiCursorVisual", { link = "Visual" })
      hl(0, "MultiCursorSign", { link = "SignColumn" })
      hl(0, "MultiCursorMatchPreview", { link = "Search" })
      hl(0, "MultiCursorDisabledCursor", { reverse = true })
      hl(0, "MultiCursorDisabledVisual", { link = "Visual" })
      hl(0, "MultiCursorDisabledSign", { link = "SignColumn" })
    end,
  },
}
