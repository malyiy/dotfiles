
eval "$(/opt/homebrew/bin/brew shellenv)"

# Added by Toolbox App
export PATH="$PATH:/Users/malyiy/Library/Application Support/JetBrains/Toolbox/scripts"
export PATH="$PATH:/Users/malyiy/.local/bin"
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

# Added by Toolbox App
export PATH="$PATH:/Users/malyiy/Library/Application Support/JetBrains/Toolbox/scripts"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Added by `rbenv init` on Sun Aug 11 21:05:49 EEST 2024
eval "$(rbenv init - --no-rehash zsh)"

alias activate_super_power='source ~/config/.phoenix'
alias persist_super_power='echo "source ~/config/.phoenix" >> ~/.zprofile'

source ~/.phoenix

eval "$(zoxide init zsh)"
