# Verify A Download

Verify installers before opening or installing them.

Use an empty download directory for each release. Do not mix installers or
checksums from different versions. Integrity verification proves file identity,
not completion of runtime acceptance or release promotion; see
[airc134 status](AIRC134.md).

airc134 is currently GitHub's stable Latest release, retained at the maintainer's
request with deferred Windows verification and other disclosed runtime gaps.
Production acceptance remains incomplete regardless of that label. Its exact
files must still pass every integrity and signing-state check below.

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
$installers = @(Get-ChildItem -File 'AiRC-*-Setup.exe')
if ($installers.Count -ne 1) { throw "Expected exactly one AiRC Setup installer" }
$installer = $installers[0]
$entries = @(Get-Content -LiteralPath SHA256SUMS | Where-Object {
  $_ -match '^([0-9a-fA-F]{64})\s+\*?(.+)$' -and $Matches[2] -ceq $installer.Name
})
if ($entries.Count -ne 1) { throw "Expected one checksum for this exact installer" }
$expected = $entries[0].Substring(0, 64).ToLowerInvariant()
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
