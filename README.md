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

### Help

If you get this error after macos update: error: Nix daemon disconnected unexpectedly (maybe it crashed?) 
Try to reinstall certs:
Check for an old symlink like this:

```sh
ls -la /etc/ssl/certs/ca-certificates.crt
```

If you have it (e.g. pointing to /etc/static/ssl/certs/ca-certificates.crt, remove and create a new one.

```sh
sudo rm /etc/ssl/certs/ca-certificates.crt
sudo ln -s /nix/var/nix/profiles/default/etc/ssl/certs/ca-bundle.crt /etc/ssl
```


