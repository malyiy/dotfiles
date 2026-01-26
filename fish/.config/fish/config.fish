if status is-interactive
    # Commands to run in interactive sessions can go here
end

source ~/.phoenix

zoxide init fish | source

# # Fish shell configuration
#
# # Homebrew initialization
# eval (/opt/homebrew/bin/brew shellenv)
#
# # PATH configuration
# fish_add_path -g $HOME/.local/bin
# fish_add_path -g /usr/local/bin
# fish_add_path -g /opt/homebrew/opt/ruby/bin
# fish_add_path -g /opt/homebrew/opt/openjdk/bin
# fish_add_path -g $HOME/.npm-global/bin
#
# # Bun
# set -gx BUN_INSTALL "$HOME/.bun"
# fish_add_path -g $BUN_INSTALL/bin
#
# # Android SDK
# set -gx ANDROID_HOME $HOME/Library/Android/sdk
# fish_add_path -g $ANDROID_HOME/emulator
# fish_add_path -g $ANDROID_HOME/platform-tools
#
# # NVM (Node Version Manager)
# set -gx NVM_DIR "$HOME/.nvm"
# if test -s "$NVM_DIR/nvm.sh"
#     # Fish doesn't support sourcing bash scripts directly, use bass or nvm.fish plugin
#     # For now, we'll note this needs the bass plugin or nvm.fish
#     # Install with: fisher install jorgebucaran/nvm.fish
# end
#
# # rbenv initialization
# if command -v rbenv >/dev/null
#     rbenv init - --no-rehash fish | source
# end
#
# # LM Studio API configuration
# set -gx LM_STUDIO_API_KEY whatever
# set -gx LM_STUDIO_API_BASE http://127.0.0.1:1234/v1
#
# # React Editor
# set -gx REACT_EDITOR zed
#
# # Aliases - Movement
# alias l="eza -a -l -h --tree --level=1 --icons=always --no-user"
# alias lt="eza -a -l -h --tree --level=1 --icons=always --no-user --total-size"
# alias ll="eza -a -l --tree --level=2 --icons=always --no-user --no-permissions --no-filesize"
# alias lll="eza -a -l --tree --level=2 --icons=always --no-user --no-permissions --no-filesize"
#
# alias ..="cd .."
# alias ...="cd ../.."
# alias ....="cd ../../.."
#
# # Aliases - Programs
# alias v="nvim"
# alias lg="lazygit"
#
# # Aliases - Utils
# alias yrid="~/utils/build-react-native-for-my-iphone.sh"
# alias bi="~/utils/bi.sh"
# alias bd="~/utils/bd.sh"
# alias dotsync="~/utils/dotsync.sh"
# alias checkinstalled="~/utils/checkinstalled.sh"
#
# # Zoxide initialization
# if command -v zoxide >/dev/null
#     zoxide init fish | source
# end

# Added by LM Studio CLI (lms)
set -gx PATH $PATH /Users/malyiy/.lmstudio/bin
# End of LM Studio CLI section

