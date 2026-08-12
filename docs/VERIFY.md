# Verify A Download

Verify installers before opening or installing them.

## Check SHA-256

Download `SHA256SUMS` into the same directory as the installer. Verify only the installer for your operating system.

### macOS

```bash
grep 'macOS-arm64\.zip$' SHA256SUMS | shasum -a 256 -c -
```

### Linux

```bash
grep '_amd64\.deb$' SHA256SUMS | sha256sum -c -
```

The installer must report `OK`. A checksum mismatch is never safe to ignore.

## Verify macOS Signing And Notarization

After expanding the ZIP:

```bash
codesign --verify --deep --strict --verbose=2 AiRC.app
spctl --assess --type execute --verbose=2 AiRC.app
xcrun stapler validate AiRC.app
```

The signature must verify, Gatekeeper must accept the application, and the notarization ticket must validate.

## Inspect A Debian Package

```bash
dpkg-deb --info airc_<version>_amd64.deb
```

Confirm:

- package: `airc`
- architecture: `amd64`
- version matches the GitHub release

## Verify The Release Manifest

`release-manifest.json` records the source revision, exact artifact names, sizes, hashes, platforms, architectures, and signing state used for the release. Its values must match the downloaded files and `SHA256SUMS`.
