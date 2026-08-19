# AiRC Orchestration

<p align="center">
  <img src="assets/airc-orchestration.png" alt="AiRC Orchestration" width="190">
</p>

<p align="center">
  <strong>One desktop workspace for AI work that outlasts a single prompt — models, tools, goals, plans, and supervised execution, all tied to your project.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-Beta-f59e0b" alt="Status: Beta">
  <a href="https://github.com/AiRC-ai/AiRC-Orchestration/actions/workflows/validate-repository.yml"><img src="https://github.com/AiRC-ai/AiRC-Orchestration/actions/workflows/validate-repository.yml/badge.svg" alt="Repository validation"></a>
</p>

<p align="center">
  <a href="https://github.com/AiRC-ai/AiRC-Orchestration/releases/latest">Download the latest Beta</a>
  &nbsp;|&nbsp;
  <a href="https://airc.ai/">AiRC.ai</a>
  &nbsp;|&nbsp;
  <a href="SUPPORT.md">Support</a>
</p>

> [!IMPORTANT]
> **AiRC Orchestration is proprietary Beta software.** Features, interfaces, integrations, and packaging may change. Download only from this repository's verified [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page and review the license before use.

Most AI chat tools reset the moment you close the tab. AiRC Orchestration is built for work that takes hours or days — it keeps your project, task, model, tools, goal, plan, and execution evidence connected so an AI workflow can make real progress without losing context.

This repository is the public home for product presentation, release artifacts, installation guides, support, and security reporting. The application source is maintained separately.

## See It In Action

<p align="center">
  <img src="assets/airc-whisper-browser-workflow.gif" alt="AiRC Orchestration Beta using the selected muse-glimmer model and the in-app browser to inspect and summarize the public AiRC Whisper repository" width="960">
</p>

<p align="center">
  <sub>A real Beta session using the <code>muse-glimmer:30b-q4_K_M-dflash</code> model and the in-app browser to find, inspect, and summarize the public <a href="https://github.com/AiRC-ai/AiRC-Whisper">AiRC Whisper</a> repository. Every frame was reviewed for private data. <a href="assets/README.md">Capture provenance</a>.</sub>
</p>

<table>
  <tr>
    <td width="33%"><img src="assets/screenshots/airc-whisper-task.png" alt="A concise public-repository browser task in AiRC Orchestration"></td>
    <td width="33%"><img src="assets/screenshots/airc-whisper-repository.png" alt="AiRC Orchestration viewing the public AiRC Whisper repository in its in-app browser"></td>
    <td width="33%"><img src="assets/screenshots/airc-whisper-summary.png" alt="AiRC Orchestration summary of AiRC Whisper beside the live public repository"></td>
  </tr>
  <tr>
    <td align="center"><sub>One-line browser task</sub></td>
    <td align="center"><sub>Live repository inspection</sub></td>
    <td align="center"><sub>Detailed architecture summary</sub></td>
  </tr>
</table>

## Why It's Different

| Capability | What it does for you |
| --- | --- |
| **Project-centered work** | Tasks, message history, model state, enabled capabilities, and working directory stay tied to the project — no re-explaining context. |
| **Goals and plans** | Give long-running work an explicit objective, track progress, and explore read-only in Plan Mode before changes begin. |
| **Model flexibility** | Switch between hosted, local, or remote model providers per session, with model-aware context and reasoning controls. |
| **Composable capabilities** | Combine tools, extensions, skills, recipes, apps, and automations instead of being locked into one chat surface. |
| **Supervised execution** | Use the optional Orchestrator layer to start, monitor, message, and interrupt agent sessions while the main task stays coordinated. |
| **Bounded delegation** | Send focused work to subagents with scoped providers, models, and tools — the main task stays in control. |
| **Natural-language automation** | Create one-time or recurring work from plain-language instructions, with project and model context attached. |
| **Integrated work surfaces** | Use development tools, terminal workflows, browser work, and computer control where enabled and explicitly permitted. |

Availability depends on the selected model, provider, operating system, configured capabilities, and permissions granted by the user.

## Download The Beta

The current Beta release is **1.45.0+airc6**. Each installer ships with verification files on the [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page.

| Platform | Architecture | Download |
| --- | --- | --- |
| macOS | Apple silicon (`arm64`) | [`AiRC-1.45.0+airc6-macOS-arm64.zip`](https://github.com/AiRC-ai/AiRC-Orchestration/releases/download/v1.45.0%2Bairc6/AiRC-1.45.0+airc6-macOS-arm64.zip) |
| Debian-family Linux | x86_64 (`amd64`) | [`airc_1.45.0+airc6_amd64.deb`](https://github.com/AiRC-ai/AiRC-Orchestration/releases/download/v1.45.0%2Bairc6/airc_1.45.0+airc6_amd64.deb) |

The macOS build is signed with a Developer ID certificate, notarized by Apple, and carries a stapled notarization ticket — Gatekeeper accepts it without warnings.

Every release includes `SHA256SUMS`, a machine-readable `release-manifest.json`, the AiRC license, the retained Apache license, and third-party notices. See [Installation](docs/INSTALL.md) and [Verify a download](docs/VERIFY.md) before first use.

## How Releases Are Verified

No installer is published until it passes the repository's release gates:

- macOS signing, notarization, stapling, and Gatekeeper acceptance
- Debian package metadata and architecture verification
- version, file-name, checksum, and manifest consistency
- clean-install, launch, branding, and upgrade checks
- inspection for private source, credentials, logs, user data, and internal build artifacts

Maintainer details are in [Publishing a release](docs/PUBLISHING.md).

## Using The Beta Responsibly

The macOS build carries a valid Developer ID signature, an Apple notarization ticket, and passes Gatekeeper without warnings. The Debian package is architecture-verified with matching checksums. Download only from this repository's [Releases](https://github.com/AiRC-ai/AiRC-Orchestration/releases) page — do not install packages offered elsewhere.

- Review model, tool, extension, automation, and operating-system permissions before use.
- Keep approval controls at the narrowest practical level for consequential actions.
- Treat browser and computer-control capabilities as privileged — enable them only when needed.
- Keep important work backed up; Beta interfaces and migration behavior may change.
- Never post diagnostics publicly without removing messages, configuration, credentials, private URLs, and personal data.

## Support And Security

- **Product or Beta-testing issues** — read [Support](SUPPORT.md) and open an issue.
- **Security vulnerabilities** — follow [Security](SECURITY.md). Do not disclose a vulnerability in a public issue.
- **Product information** — visit [airc.ai](https://airc.ai/).

## License

Original AiRC software, modifications, documentation, release tooling, artwork, and branding are proprietary and governed by the [AiRC Orchestration Proprietary Beta License](LICENSE). Inherited open-source and third-party components retain their respective licenses and notices. See the [license map](LICENSES.md), [NOTICE](NOTICE), [Apache License 2.0](licenses/Apache-2.0.txt), and [third-party notices](THIRD_PARTY_NOTICES.md).