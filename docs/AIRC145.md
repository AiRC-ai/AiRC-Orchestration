# airc145: Native Companion And Host Reliability

Version `1.45.0+airc145` provides the computer host for the native AiRC 7 companion on iPhone and iPad. Application source is frozen at `b673e611413e8f2a9026b6c5f6bf1f922a97a5f1`. The native companion is a separate App Store submission, version 7.0.0 build 351, from source `744a8b1f01251903ca96501deab804e975492af0`.

## What Changes

- Continue conversations from the computer or companion with live streaming, automatic reconnect and durable send recovery. Stable message identities suppress duplicate echoes and preserve a newer follow-up draft.
- Choose the host's provider, model and supported reasoning effort. Track context, token speed, cost, goals, plans, agents and orchestration through compact controls.
- Browse pinned, priority, project or chronological chat groups. Projects and unassigned chats collapse, show five chats initially, and expand on request. Global New chat starts unassigned; project New chat inherits its project.
- Open the companion directly into a ready chat when a primary host is saved. Search remains in the top toolbar, and a swipe or menu button opens navigation.
- Keep routine thinking and tool activity collapsed, with expandable work summaries. Photos display inline; supported documents open in native previews with Files/Share and Photos destinations where appropriate.
- Reach host-backed Recipes, Skills, Apps, Automations, Extensions, Session History, Documentation and Settings. Available actions reflect the host's configuration and permission controls.
- View supported Computer Use, Browser and Playwright activity in a compact floating preview. These previews are view-only; they do not grant remote pointer or keyboard input.
- Compact manually from context controls. The host preserves original history when compaction cannot safely finish, and bounds retries instead of repeating an exhausted summary.
- Stop propagates to owned tool and browser descendants. Desktop history keeps its complete content rather than inheriting companion preview placeholders.
- Ship the required external Playwright runtime and verify it loads before accepting each desktop package.

## Installation And Pairing

Download the installer for your platform from the [release](https://github.com/AiRC-ai/AiRC-Orchestration/releases/tag/v1.45.0%2Bairc145) and follow [Installation](INSTALL.md) and [Verify a download](VERIFY.md). Finish active chats, approvals, automations and terminals before replacing the computer app. Retain a profile backup and the previous installer until the update is accepted.

Configure the host's provider/model, enable companion access in Settings, then display a fresh pairing QR code. Scan directly on the iPhone and compare the certificate fingerprint before trusting the host. The computer must stay awake and reachable on the local or private network. Provider credentials, AI execution, tools and saved project data remain on the host.

The native iOS update replaces the previous standalone interface after Apple approves it. Publishing these desktop installers does not itself update the App Store app. APNs and locked-phone push notifications are not enabled. See [Companion privacy](../COMPANION_PRIVACY.md).

## Verification Scope

The source gates include 3,582 desktop tests passed with one explicit skip, strict Rust formatting and all-target Clippy, desktop typecheck and lint with zero ESLint warnings, 375 companion desktop tests, and 19 isolated relay contracts. The native release passed simulator UI checks, archive/export checks and installation on the owner's iPhone. The owner accepted the installed Mac 145 and iOS 351 result.

### macOS Apple Silicon

The final ZIP is Developer ID signed, notarized and stapled. Re-extraction passes strict nested signatures, Gatekeeper and ticket validation. Both the staged app and `/Applications/AiRC.app` pass the 4,000-message lifecycle gate: progressive history, once-only sending, goal/plan persistence, renderer recovery, desktop restart, automation interruption and orchestration. The previous profile and application rollback are retained.

Signed-package two-client tests exercised the actual desktop bridge and reducer with a synthetic phone: streaming before completion, reconnect catch-up, durable receipts, rejected-send fences and exactly one persisted message per origin. Real 1Cat compaction reduced 30,000 synthetic messages to two agent-visible entries and 308 retained context tokens while preserving original content and workflow. A real packaged Playwright worker and Chromium exited within 292 ms of Stop acknowledgement. These measurements qualify those scenarios, not every provider or physical simultaneous-send timing.

### Debian amd64

The exact-source Debian package passed metadata, architecture, executable, launcher, icon and installed-file verification on Debian 13.6. Upgrade from airc134 preserved a 4,000-message fixture through schema migration. The installed package passed the same recovery, once-only-send, automation and orchestration lifecycle used on macOS. Package removal and clean reinstall preserved the normal profile. Normal GNOME launch and reopening retained one app/backend, with pinned-TLS health and status returning 200 and no debug or acceptance flags.

Installed lifecycle screenshots were reviewed. The normal GNOME Wayland desktop has no separate remote screenshot. VM graphics and runtime results do not establish hardware GPU acceleration on other Linux or Windows systems.

### Windows

No Windows installer is included in airc145. The Windows candidate passed its installed long-session and recovery tests, but its app-link check did not preserve a prefilled chat draft. It also has no Authenticode signature. It remains withheld rather than being qualified by the Mac or Debian results. Historical Windows installers do not provide the native companion host update.

### Hosted Artifacts

The uploaded draft's Mac and Debian assets passed all three hosted validation jobs in [run 43347208760](https://github.com/AiRC-ai/AiRC-Orchestration/actions/runs/43347208760), including a fresh Mac download's strict signature, Gatekeeper and stapled-ticket checks. Publication triggers a separate validation of the public files. A hosted checksum pass is distinct from installed runtime acceptance.

| Artifact | SHA-256 |
| --- | --- |
| macOS arm64 ZIP | `9d21fc5074419937d4a904812ee7780ff2e4edb8b80b0768e4d81199da73b318` |
| Debian amd64 package | `53ebafc47493ccfb6deaec13235f12b77c750480da93413b39ea6354122fa3a1` |

The release manifest, checksums, updater metadata and license notices accompany the installers. Historical [airc134 acceptance gaps](AIRC134.md) remain documented separately.
