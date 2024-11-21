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
						];
						onActivation.cleanup = "zap";
						onActivation.autoUpdate = true;
						onActivation.upgrade = true;
				};

				fonts.packages = [
						(pkgs.nerdfonts.override { fonts = [ "JetBrainsMono" ]; })
				];

				# Auto upgrade nix package and the daemon service.
				services.nix-daemon.enable = true;
				# nix.package = pkgs.nix;

				# Necessary for using flakes on this system.
				nix.settings.experimental-features = "nix-command flakes";

				# Enable alternative shell support in nix-darwin.
				# programs.fish.enable = true;

				# Set Git commit hash for darwin-version.
				system.configurationRevision = self.rev or self.dirtyRev or null;

				# Used for backwards compatibility, please read the changelog before changing.
				# $ darwin-rebuild changelog
				system.stateVersion = 5;

				# The platform the configuration will be used on.
				nixpkgs.hostPlatform = "aarch64-darwin";
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
