# AiRC Orchestration

<p align="center">
  <img src="assets/airc-orchestration.png" alt="AiRC Orchestration" width="220">
</p>

<p align="center">
  Desktop AI orchestration for projects, models, tools, automations, browser work, and supervised execution.
</p>

<p align="center">
  <a href="https://github.com/AiRC-ai/AiRC-Orchestration/releases/latest">Download the latest release</a>
  &nbsp;|&nbsp;
  <a href="docs/INSTALL.md">Installation</a>
  &nbsp;|&nbsp;
  <a href="SUPPORT.md">Support</a>
</p>

This is the official public distribution and support repository for **AiRC Orchestration**. Application source is maintained separately. Compiled installers are published only through [GitHub Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases).

## Downloads

| Platform | Architecture | Release file |
| --- | --- | --- |
| macOS | Apple silicon (`arm64`) | `AiRC-<version>-macOS-arm64.zip` |
| Debian, Ubuntu, Kali, and compatible distributions | x86_64 (`amd64`) | `airc_<version>_amd64.deb` |

Each release also includes:

- `SHA256SUMS` for integrity verification
- `release-manifest.json` with version, architecture, source revision, size, and signing metadata
- license and third-party notices

See [Installation](docs/INSTALL.md) and [Verify a download](docs/VERIFY.md) before first use.

## What AiRC Orchestration Does

- Organizes AI work around projects and persistent tasks
- Connects to hosted, local, and remote model providers
- Runs tools, extensions, skills, and recurring automations
- Supports supervised reviews through the Orchestrator workflow
- Provides integrated browser and desktop-control workflows where enabled

Availability depends on the selected model, provider, operating system, configured extensions, and permissions granted by the user.

## Release Policy

Public releases must pass the repository's release gates before publication:

- macOS application is signed, notarized, and accepted by Gatekeeper
- Debian metadata and architecture are verified
- both installers match the declared version and checksums
- branding, launch behavior, clean installation, and upgrade behavior are tested
- no private source, credentials, logs, user data, or internal build artifacts are included

Maintainer details are in [Publishing a release](docs/PUBLISHING.md).

## Support And Security

- For installation or product issues, read [Support](SUPPORT.md) and open an issue.
- For vulnerabilities, follow [Security](SECURITY.md). Do not disclose a vulnerability in a public issue.
- For product information, visit [airc.ai](https://airc.ai/).

## License

Distribution materials in this repository are provided under the [Apache License 2.0](LICENSE). Third-party components retain their respective licenses and notices. See [NOTICE](NOTICE) and [Third-party notices](THIRD_PARTY_NOTICES.md).
