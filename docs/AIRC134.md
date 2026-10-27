# airc134 Changes And Acceptance Status

Updated October 27, 2026. Version `1.45.0+airc134` is
[public and currently marked stable Latest on GitHub](https://github.com/AiRC-ai/AiRC-Orchestration/releases/tag/v1.45.0%2Bairc134).
It was originally published as a prerelease on October 19 (Pacific time) with
further Windows verification deferred. The maintainer has now directed that
its existing non-prerelease/Latest status remain unchanged. All three installers
and eight companion files are publicly downloadable and unchanged.

**Production acceptance remains incomplete.** The channel label does not
qualify pending workflows or prove the actual updater handoff. GitHub's Latest
release may be offered by update checks; no new rollout or installer change is
performed by this documentation update. `airc121` remains the previous verified
baseline and retained rollback reference, not GitHub's current Latest release.

Authenticated hosted-file downloads match the accepted files.
The [release-triggered validation workflow](https://github.com/AiRC-ai/AiRC-Orchestration/actions/runs/39361540791)
passes on Linux, macOS, and Windows, including macOS signature/notarization
checks and Windows Setup's actual `NotSigned` state. These are hosted-file
checks, not completion of the remaining runtime gates below. All eleven files
were independently downloaded without authentication after publication and
matched the frozen release files and GitHub asset digests. The downloaded Mac
archive also passed signature, Gatekeeper, notarization-ticket, and architecture
verification. Public-download integrity cannot replace runtime acceptance.

## Changes

- **Live steering:** Enter and Send can admit ordinary-text steering while a
  reply is running. Delivery occurs at supported agent input boundaries, not
  by interrupting an in-progress generation. Stop remains a separate action.
- **Configured compaction ratio:** the agent checks the configured threshold
  before subsequent model rounds, including queued steering and scheduled runs,
  instead of waiting for the model's maximum context. A generation already in
  progress is not interrupted to compact it.
- **Image-limit recovery:** an explicit pre-generation two-image rejection
  receives one bounded adapted retry. Older tool screenshots may be omitted
  from that outgoing request with a disclosure. User attachments, the newest
  tool image, and saved history remain intact; a started stream is never replayed.
- **Computer Use preview:** a manually opened, task-scoped in-app preview shows
  the selected target, capture age, and ownership. It supports placement and
  expand/restore. Hide and Escape do not reopen it on later captures. Native
  Computer Use remains macOS-only with existing user-granted permissions; this
  is not an MCP-app preview or a floating native window.

## Installers And Integrity

All three installers were built from the same frozen source revision,
`c163bcbb5bc63ffb2105d52438bf352a174407c6`. Documentation-only changes do not
rebuild or replace these bytes.

| Platform | Installer | Signing |
| --- | --- | --- |
| macOS Apple silicon | `AiRC-1.45.0+airc134-macOS-arm64.zip` | Developer ID signed, notarized, and stapled |
| Windows x64 | `AiRC-1.45.0+airc134-Setup.exe` | Intentionally unsigned; Setup and AiRC executables report `NotSigned`, manifest `codeSigned: false` |
| Debian-family Linux amd64 | `airc_1.45.0+airc134_amd64.deb` | Package metadata and payload integrity verified |

Windows may display an unrecognized-app warning. Signing status does not waive
checksum or production-acceptance requirements. Verify the downloaded
installer against `SHA256SUMS` and `release-manifest.json` from the
same release using the [verification guide](VERIFY.md).

## Recorded Acceptance

Source gates, cross-platform build/archive provenance, macOS signature and
notarization, protected installed upgrades, and Windows clean install/uninstall
pass. Seven staged or installed long-task, automation, Browser/GitHub, and
recovery lifecycle receipts pass in their recorded scopes. Linux headless
acceptance does not replace normal desktop acceptance. Windows' explicit
**Open browser** fallback passes; immediate automatic reattachment is not
established by every run.

Installed controlled-provider tests pass for steering, configured-ratio
compaction, and image recovery. These are not a complete real-account provider
matrix. Installed Mac WebGL1/2 pixel checks pass through ANGLE/Metal on Apple
M2 Max, not on every platform or GPU. A narrow Mac native fixture passes exact
input, stale-index rejection, preview controls, takeover/return, and Emergency
Stop; it does not cover every safety or multi-window case.

## Deferred Windows Verification

Further Windows visible renderer and protocol/draft checks were deferred by the
maintainer on October 19 for public prerelease publication. The earlier missing
draft remains unresolved, not passed. This does not change installer bytes,
checksums, unsigned status, or the completed Windows checks recorded above.

## Still Required For Production Qualification

- Resolution and acceptance of the deferred Windows renderer/protocol flow.
- Normal Linux desktop data/secondary-launch checks and the packaged
  existing-account interactive/automation provider matrix.
- Native held-input cleanup, busy cancellation, two-task/two-native-window
  preview recovery, display/DPI changes, spontaneous stale references, and
  matched baseline measurements.
- Complete signed installed Mac Local Network acceptance. The current privacy
  pane shows AiRC.app enabled; responsible-code identity and an approved real
  LAN request remain unproven by that appearance/current-state check alone.
- A real newer-updater download, integrity check, and install handoff, with an
  explicitly approved rollout order and protected rollback.
- Private source integration and final production qualification after the
  outstanding gates pass. Public hosted-download integrity is a separate check.

No pending production check is marked passed by publication, hosted checksums,
or README updates. Retaining the existing stable/Latest label does not claim a
completed production qualification. Running tasks must not be interrupted for
acceptance or an upgrade. Follow the [publishing contract](PUBLISHING.md).
