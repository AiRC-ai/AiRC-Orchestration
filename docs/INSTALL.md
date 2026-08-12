# Install AiRC Orchestration

> [!IMPORTANT]
> No public AiRC Orchestration installer has been published yet. AiRC Orchestration remains in active Beta development. Follow the repository's [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page for the first verified public build; do not download installers offered elsewhere.

The steps below document the planned installation flow once public Beta artifacts are available. Verify every downloaded file before opening or installing it.

## macOS Apple Silicon

1. Download `AiRC-<version>-macOS-arm64.zip` and `SHA256SUMS` from the same GitHub release.
2. Follow [Verify a download](VERIFY.md).
3. Open the ZIP archive.
4. Move `AiRC.app` to `/Applications`.
5. Launch **AiRC** from Applications.

The public macOS build must be signed and notarized. Do not bypass Gatekeeper for an official release. If macOS rejects the application, preserve the exact message and open a support issue.

Some optional features require explicit macOS permissions, such as Accessibility, Screen Recording, microphone, calendar, or reminders access. Grant only the permissions needed for features you choose to use.

## Debian, Ubuntu, Kali, And Compatible Systems

The planned initial Linux package targets x86_64 systems using Debian packages.

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

## Upgrading During Beta

Read the release notes before every upgrade and back up important projects and configuration first. Compatibility and migration behavior may change during Beta; follow any version-specific instructions included with the release.

## Uninstalling

### macOS

Quit AiRC and remove `/Applications/AiRC.app`. User configuration is not removed automatically.

### Debian-family systems

```bash
sudo apt remove airc
```

Package removal does not automatically delete user projects or configuration.
