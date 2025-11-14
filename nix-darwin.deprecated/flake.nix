# darwin-rebuild switch --flake nix-darwin.#malyiy
{
		description = "Malyiy nix-darwin system flake";

		inputs = {
				nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
				nix-darwin.url = "github:LnL7/nix-darwin";
				nix-darwin.inputs.nixpkgs.follows = "nixpkgs";
				nix-homebrew.url = "github:zhaofengli-wip/nix-homebrew";
				home-manager = {
						url = "github:nix-community/home-manager";
						inputs.nixpkgs.follows = "nixpkgs";
				};
		};

		outputs = inputs@{ self, nix-darwin, nixpkgs, nix-homebrew, home-manager, ... }:
		let configuration = { pkgs, config, ... }: {
				# List packages installed in system profile. To search by name, run:
				# $ nix-env -qaP | grep wget

				nixpkgs.config.allowUnfree = true;

				home-manager.backupFileExtension = "backup";

				environment.systemPackages = [
						pkgs.neovim
						pkgs.nixd
						pkgs.jq
						pkgs.lazygit
						pkgs.jdk
						pkgs.eza
						pkgs.docker
						pkgs.gh
						pkgs.zoxide
						pkgs.yarn
						pkgs.rbenv
						pkgs.cocoapods
						pkgs.bat
						pkgs.loopwm
						pkgs.mkalias
						pkgs.eslint
						pkgs.python311
						pkgs.obsidian
						pkgs.raycast
            pkgs.delta
            pkgs.less
            pkgs.watchman
            pkgs.ios-deploy
            pkgs.utm
            pkgs.speedtest-cli
            pkgs.ffmpeg
            pkgs.btop
            pkgs.stats
            pkgs.ripgrep 
	    pkgs.wget
				];

				# nixpkgs.config.allowUnfreePredicate =
				# pkg: builtins.elem (pkgs.lib.getName pkg) [
				#     "zerotierone"
				# ];

				homebrew = {
						enable = true;
						casks = [
								"zed"
								"linearmouse"
                "warp"
                "ollama"
                "docker"
						];
						onActivation.cleanup = "zap";
						onActivation.autoUpdate = true;
						onActivation.upgrade = true;
				};

				fonts.packages = [
						pkgs.nerd-fonts.jetbrains-mono
				];

				# Auto upgrade nix package and the daemon service.
				nix.enable = true;
				# nix.package = pkgs.nix;

				# Necessary for using flakes on this system.
				nix.settings.experimental-features = "nix-command flakes";

        system.primaryUser = "malyiy";

				# Enable alternative shell support in nix-darwin.
				# programs.fish.enable = true;

				# Set Git commit hash for darwin-version.
				system.configurationRevision = self.rev or self.dirtyRev or null;

				# Used for backwards compatibility, please read the changelog before changing.
				# $ darwin-rebuild changelog
				system.stateVersion = 5;

				# The platform the configuration will be used on.
				nixpkgs.hostPlatform = "aarch64-darwin";
				system.activationScripts.applications.text = let
												env = pkgs.buildEnv {
																				name = "system-applications";
																				paths = config.environment.systemPackages;
																				pathsToLink = "/Applications";
												};
				in
												pkgs.lib.mkForce ''
																				# Set up applications.
																				echo "setting up /Applications..." >&2
																				rm -rf /Applications/Nix\ Apps
																				mkdir -p /Applications/Nix\ Apps
																				find ${env}/Applications -maxdepth 1 -type l -exec readlink '{}' + |
																				while read -r src; do
																												app_name=$(basename "$src")
																												echo "copying $src" >&2
																												${pkgs.mkalias}/bin/mkalias "$src" "/Applications/Nix Apps/$app_name"
																				done
												'';

				};
				in
		{
				# Build darwin flake using:
				# $ darwin-rebuild build --flake .#malyiy
				darwinConfigurations."malyiy" = nix-darwin.lib.darwinSystem {
						system = "aarch64-darwin";
						modules = [
								configuration
								nix-homebrew.darwinModules.nix-homebrew
								home-manager.darwinModules.home-manager
								{
										users.users.malyiy.home = "/Users/malyiy";
										home-manager.useGlobalPkgs = true;
										home-manager.useUserPackages = true;
										home-manager.users.malyiy = import ./home.nix;

										nix-homebrew = {
												enable = true;
												enableRosetta = true;
												user = "malyiy";
												autoMigrate = true;
										};
								}
						];
				};

				# Expose the package set, including overlays, for convenience.
				darwinPackages = self.darwinConfigurations."malyiy".pkgs;
		};
}
