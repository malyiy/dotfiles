eval "$(/opt/homebrew/bin/brew shellenv)"

export PATH="$PATH:/Users/$(whoami)/.local/bin"
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

export PATH="$PATH:/usr/local/bin"

export PATH="/opt/homebrew/opt/ruby/bin:$PATH"
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

export PATH="/opt/homebrew/opt/openjdk/bin:$PATH"

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Added by `rbenv init` on Sun Aug 11 21:05:49 EEST 2024
eval "$(rbenv init - --no-rehash zsh)"

alias activate_super_power='source ~/config/.phoenix'
alias persist_super_power='echo "source ~/config/.phoenix" >> ~/.zprofile'

source ~/.phoenix
 
export LM_STUDIO_API_KEY=whatever
# export LM_STUDIO_API_BASE=http://localhost:1234/v1
export LM_STUDIO_API_BASE=http://127.0.0.1:1234/v1

export PATH=~/.npm-global/bin:$PATH

eval "$(zoxide init zsh)"
