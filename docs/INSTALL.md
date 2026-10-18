# Install AiRC Orchestration

> [!IMPORTANT]
> AiRC Orchestration is under active development. Download only from the repository's [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page; do not install packages offered elsewhere.

Verify every downloaded file before opening or installing it.

Use the recommended release linked in the [main README](../README.md). The
[airc134 candidate](AIRC134.md) still has open acceptance gates; a draft is not
a recommended release or an automatic update.

## macOS Apple Silicon

1. Download `AiRC-<version>-macOS-arm64.zip` and `SHA256SUMS` from the same GitHub release.
2. Follow [Verify a download](VERIFY.md).
3. Open the ZIP archive.
4. Move `AiRC.app` to `/Applications`.
5. Launch **AiRC** from Applications.

The public macOS build must be signed and notarized. Do not bypass Gatekeeper for an official release. If macOS rejects the application, preserve the exact message and open a support issue.

Some optional features require explicit macOS permissions, such as Accessibility, Screen Recording, microphone, calendar, reminders, or Local Network access. Grant only the permissions needed for features you choose to use. When AiRC first connects to a device or service on your local network, choose **Allow** in the macOS prompt. You can review or change this later under **System Settings > Privacy & Security > Local Network**.

If a local connection works in Terminal but not in AiRC, confirm that AiRC is allowed under **Local Network**. Wait for all running tasks and automations to finish before quitting and reopening the app to retry. Do not disable macOS privacy protections or bypass the signed application package.

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

Do not install over an active AiRC session or select **Install & Restart** while
tasks are running. Finish the work first and retain a verified previous installer
and configuration backup until the new version is accepted. Windows uses the
full Setup installer for each revision; a folder named `app-1.45.0` alone does
not identify the installed `+airc` revision. Check the app's displayed version.

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
