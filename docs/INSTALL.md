# Install AiRC Orchestration

> [!IMPORTANT]
> AiRC Orchestration is under active development. Download only from the repository's [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page; do not install packages offered elsewhere.

Verify every downloaded file before opening or installing it.

## macOS Apple Silicon

1. Download `AiRC-<version>-macOS-arm64.zip` and `SHA256SUMS` from the same GitHub release.
2. Follow [Verify a download](VERIFY.md).
3. Open the ZIP archive.
4. Move `AiRC.app` to `/Applications`.
5. Launch **AiRC** from Applications.

The public macOS build must be signed and notarized. Do not bypass Gatekeeper for an official release. If macOS rejects the application, preserve the exact message and open a support issue.

Some optional features require explicit macOS permissions, such as Accessibility, Screen Recording, microphone, calendar, or reminders access. Grant only the permissions needed for features you choose to use.

## Windows

The Windows package targets 64-bit Windows 10 and Windows 11.

1. Download `AiRC-<version>-Setup.exe` and `SHA256SUMS` from the same GitHub release.
2. Follow [Verify a download](VERIFY.md).
3. Open `AiRC-<version>-Setup.exe`.
4. The one-click Squirrel installer installs AiRC for the current user and launches it. Administrator access is not normally required.

The current Windows installer is not Authenticode-signed, so Microsoft Defender SmartScreen may show an unrecognized-app warning. Continue only after verifying the exact installer against the release checksum and confirming it came from this repository. The release manifest records the signing state for every Windows installer.

## Debian-Family Linux

The Linux package targets x86_64 (`amd64`) systems that support Debian packages.

1. Download `airc_<version>_amd64.deb` and `SHA256SUMS` from the same GitHub release.
2. Follow [Verify a download](VERIFY.md).
3. Install the package:

   ```bash
   sudo apt install ./airc_<version>_amd64.deb
   ```

4. Launch **AiRC** from the desktop application menu or run:

   ```bash
   airc
   ```

If package dependencies cannot be resolved, run your distribution's normal package index update and retry with `apt`. Avoid forcing installation with `dpkg --force-*`.

## Upgrading Between Releases

Read the release notes before every upgrade and back up important projects and configuration first. Compatibility and migration behavior may evolve between releases; follow any version-specific instructions included with the release.

## Uninstalling

### macOS

Quit AiRC and remove `/Applications/AiRC.app`. User configuration is not removed automatically.

### Debian-family systems

```bash
sudo apt remove airc
```

Package removal does not automatically delete user projects or configuration.

### Windows

Uninstall **AiRC** from **Settings > Apps > Installed apps**. User projects and configuration are not removed automatically.
