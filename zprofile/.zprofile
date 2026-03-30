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

if command -v nvim &>/dev/null; then
    export EDITOR="nvim"
else
    export EDITOR="vim"
fi

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

# Added by `rbenv init` on Sun Aug 11 21:05:49 EEST 2024
eval "$(rbenv init - --no-rehash zsh)"

source ~/.phoenix

source $(brew --prefix)/share/zsh-autosuggestions/zsh-autosuggestions.zsh

export ENABLE_EXPERIMENTAL_MCP_CLI=true

export LM_STUDIO_API_KEY=whatever
# export LM_STUDIO_API_BASE=http://localhost:1234/v1
export LM_STUDIO_API_BASE=http://127.0.0.1:1234/v1

export PATH=~/.npm-global/bin:$PATH

eval "$(zoxide init zsh)"

[ -f ~/dotfiles/.env ] && source ~/dotfiles/.env

function glm() {
    (
        export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
        export ANTHROPIC_AUTH_TOKEN="$GLM_API_TOKEN"
        export ANTHROPIC_DEFAULT_OPUS_MODEL="glm-5.1"
        export ANTHROPIC_DEFAULT_HAIKU_MODEL="glm-5"
        export ANTHROPIC_DEFAULT_SONNET_MODEL="glm-4.7"

        claude --dangerously-skip-permissions --chrome "$@"
    )
}

function zz() {
	local tmp="$(mktemp -t "yazi-cwd.XXXXXX")" cwd
	command yazi "$@" --cwd-file="$tmp"
	IFS= read -r -d '' cwd < "$tmp"
	[ "$cwd" != "$PWD" ] && [ -d "$cwd" ] && builtin cd -- "$cwd"
	rm -f -- "$tmp"
}

