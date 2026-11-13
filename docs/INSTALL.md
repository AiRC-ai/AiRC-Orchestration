# Install AiRC Orchestration

> [!IMPORTANT]
> AiRC Orchestration is under active development. Download only from the repository's [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page; do not install packages offered elsewhere.

Verify every downloaded file before opening or installing it.

The [main README](../README.md) links the airc145 installers. Read the [version-specific release notes](AIRC145.md), finish running work, back up important data, and retain the previous installer before upgrading. Platform and signing support are recorded in the release manifest.

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

Windows instructions apply only to releases that include a Windows installer. Check the current release manifest first. The package targets 64-bit Windows 10 and Windows 11.

1. Download `AiRC-<version>-Setup.exe` and `SHA256SUMS` from the same GitHub release.
2. Follow [Verify a download](VERIFY.md).
3. Open `AiRC-<version>-Setup.exe`.
4. The one-click Squirrel installer installs AiRC for the current user and launches it. Administrator access is not normally required.

Historical unsigned Windows installers are not Authenticode-signed, so Microsoft Defender SmartScreen may show an unrecognized-app warning. Continue only after verifying the exact installer against the release checksum and confirming it came from this repository. The release manifest records the signing state for every Windows installer.

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

The airc145 macOS updater metadata points to the same signed and notarized ZIP as the manual download. Do not change update preferences or restart active work merely to test the update path.

## Pairing the iPhone or iPad Companion

1. Install the native AiRC 7 companion when the update becomes available in the App Store. The computer app alone does not update the phone app.
2. Open AiRC Orchestration on your computer and configure a provider and model.
3. Enable companion access in Settings and display a fresh pairing QR code.
4. Add the host in the companion, scan directly on the phone, and compare the certificate fingerprint before tapping Trust.
5. Keep the host awake and reachable over your local or private network. Chats, files, tools, and provider credentials stay on the host; the companion is its remote interface.

Pairing is required once per device. The companion reconnects to the saved primary host on launch. Available controls depend on the host, provider and permissions. APNs notifications while the phone is locked are not enabled. See [Companion privacy](../COMPANION_PRIVACY.md).

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
