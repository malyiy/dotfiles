### Instalation

Install nix:
```sh
sh <(curl -L https://nixos.org/nix/install)
```

Install nix-darwin and apply configuration:
```sh
nix run nix-darwin --extra-experimental-features "nix-command flakes" -- switch --flake nix-darwin/.#malyiy --impure
```


### Links:
URL: https://nixos.org/download/

