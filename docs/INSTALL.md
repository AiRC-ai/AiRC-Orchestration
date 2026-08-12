# Install AiRC Orchestration

Download installers only from the repository's [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page. Verify the file before installation.

## macOS Apple Silicon

1. Download `AiRC-<version>-macOS-arm64.zip` and `SHA256SUMS` from the same release.
2. Follow [Verify a download](VERIFY.md).
3. Open the ZIP archive.
4. Move `AiRC.app` to `/Applications`.
5. Launch **AiRC** from Applications.

The public macOS build must be signed and notarized. Do not bypass Gatekeeper for an official release. If macOS rejects the application, preserve the exact message and open a support issue.

Some optional features require explicit macOS permissions, such as Accessibility, Screen Recording, microphone, calendar, or reminders access. Grant only the permissions needed for features you choose to use.

## Debian, Ubuntu, Kali, And Compatible Systems

The initial Linux package targets x86_64 systems using Debian packages.

1. Download `airc_<version>_amd64.deb` and `SHA256SUMS` from the same release.
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

## Upgrading

Install the newer package over the existing version. AiRC keeps compatibility with existing application configuration unless release notes explicitly describe a migration.

Back up important projects and configuration before a major upgrade.

## Uninstalling

### macOS

Quit AiRC and remove `/Applications/AiRC.app`. User configuration is not removed automatically.

### Debian-family systems

```bash
sudo apt remove airc
```

Package removal does not automatically delete user projects or configuration.
