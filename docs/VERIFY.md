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

### Windows

In PowerShell, from the folder containing the installer and `SHA256SUMS`:

```powershell
$installer = Get-ChildItem -File 'AiRC-*-Setup.exe' | Select-Object -First 1
$expected = (Select-String -Path SHA256SUMS -Pattern 'Setup\.exe$').Line.Split()[0].ToLowerInvariant()
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer.FullName).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "AiRC installer checksum mismatch" }
"AiRC installer checksum verified: $actual"
```

The verification command must succeed. A checksum mismatch is never safe to ignore.

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

## Inspect Windows Signing State

```powershell
Get-AuthenticodeSignature -LiteralPath .\AiRC-<version>-Setup.exe |
  Select-Object Status, StatusMessage
```

Compare the result with the `codeSigned` value for the Windows installer in `release-manifest.json`. The current installer is unsigned, so Windows may report `NotSigned`; that is expected only when the manifest also records `false` and the SHA-256 checksum matches.

## Verify The Release Manifest

`release-manifest.json` records the source revision, exact artifact names, sizes, hashes, platforms, architectures, and signing state used for the release. Its values must match the downloaded files and `SHA256SUMS`.
