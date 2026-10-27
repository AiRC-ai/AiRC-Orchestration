# Publishing A Release

This repository is a release boundary. It must receive only versioned,
integrity-verified artifacts from the private application source repository.
Production releases require the full acceptance below. Explicitly authorized
public prereleases must disclose incomplete runtime checks and remain separate
from the recommended stable release. A GitHub channel label is not itself
evidence that production qualification passed; record both facts accurately.

## Release Artifacts

- `AiRC-<version>-macOS-arm64.zip` when publishing macOS
- `latest-mac.yml` when publishing macOS; generated from the exact notarized ZIP
- `airc_<version>_amd64.deb` when publishing Debian
- `AiRC-<version>-Setup.exe` when publishing Windows
- `SHA256SUMS`
- `release-manifest.json`
- `LICENSE`
- `LICENSES.md`
- `APACHE-2.0.txt`
- `NOTICE`
- `THIRD_PARTY_NOTICES.md`

## Release Gates

Before staging a release:

1. Build every included installer from the same clean source revision.
2. Run all required Rust and desktop tests in the source repository.
3. Verify application branding and launch behavior on every included platform.
4. Verify clean install and in-place upgrade behavior.
5. Sign and notarize the macOS application with the production identity.
6. Confirm Gatekeeper acceptance and stapled notarization after extracting the final ZIP.
7. Confirm `latest-mac.yml` names the exact ZIP and matches its size and SHA-512 digest.
8. When publishing Debian, confirm package name `airc`, architecture `amd64`, version, desktop entry, executable, and icon.
9. When publishing Windows, confirm the Squirrel installer performs a per-user install, launches the branded application, and record its Authenticode state accurately.
10. Confirm the release contains no credentials, logs, user data, source archives, debug symbols, or unsupported package formats.

## Stage The Release

From this repository:

```bash
scripts/stage-release.sh \
  <version> \
  <40-character-source-commit> \
  /path/to/AiRC.zip \
  /path/to/airc_<version>_amd64.deb \
  /path/to/AiRC-<version>-Setup.exe \
  /path/to/staging-directory
```

The script renames the macOS archive and Windows installer consistently, generates
the release manifest, checksums, and signed-update feed metadata, copies legal
notices, and runs cross-platform validation. The updater metadata uses a
monotonically increasing native macOS version while retaining the full `+aircNN`
release name for display. Set `AIRC_WINDOWS_CODE_SIGNED=true` only after a Windows
runner reports a valid Authenticode signature for the exact installer.

Use `-` for a platform that is not included. For example, a macOS-only release
passes `/path/to/AiRC.zip - -` for the three installer arguments. At least one
installer is always required.

On macOS, also run:

```bash
scripts/verify-macos-release.sh /path/to/staging-directory/AiRC-<version>-macOS-arm64.zip
```

## Publish Safely

1. Create a draft GitHub release named `AiRC <version>` with tag `v<version>`.
2. Upload every file from the staging directory.
3. Run the **Validate release** workflow for the draft tag, or use the equivalent manual validation below when Actions is unavailable. The workflow uses a narrowly scoped `contents: write` token because GitHub exposes draft releases only to identities with push access; all other workflow permissions remain disabled.
4. Review release notes, checks, file names, sizes, architectures, and checksums.
5. Publish only after validation passes for every installer included in the release.

By default, keep a candidate draft while any required source or packaged-runtime
gate is open. File validation and uploading all installers do not establish real-account,
native safety, permission, migration, protocol, or updater acceptance. The
[airc134 status](AIRC134.md) distinguishes these checks. Do not label a candidate
as recommended, move Latest, or integrate unqualified source merely to make
documentation match a desired release date.

### Recorded airc134 Channel Decisions

The October 19, 2026 authorization published airc134 as a public **prerelease**
with further Windows verification deferred, initially retaining airc121 as
stable/Latest. Hosted-file checks and independent anonymous downloads passed;
that event did not complete production acceptance.

On October 27 (UTC), GitHub already reported airc134 as non-prerelease and Latest.
The maintainer explicitly directed: **Leave GitHub status unchanged**. Retain
that status. Reconcile the README, guides, release notes and status page without
changing release flags, the Latest pointer, installers, manifest, checksums or
updater metadata. Do not infer who previously changed the label or claim this
documentation update performed a promotion.

All recorded failures, deferred checks and incomplete production gates remain
visible. This decision is not permission to integrate unqualified source into
private main, fabricate runtime passes, install over active work or disturb
tasks. It is a specific channel decision for airc134, not a release-policy
exception to infer for future versions. A real updater handoff still needs
independent acceptance; GitHub Latest is not proof of a successful update.

Documentation-only updates may be published separately. Link the actual current
release and disclose its limits; retain older qualified baseline downloads as
historical/rollback references, not as the current Latest. Preserve the frozen
source revision and artifact identity. Update the root README, installation and
verification guides, release notes and version-specific status page together.
Historical demo assets must not be represented as screenshots of the new version.

After changing the PowerShell download-verification example, run
`pwsh -NoProfile -File scripts/test-download-verification.ps1`. It exercises the
actual documented snippet with valid files and rejected missing, ambiguous,
wrong-name, duplicate, and tampered-checksum fixtures in a disposable directory.

Do not replace assets on a published release. If an installer changes, issue a new version with new checksums and a new manifest.

### Manual Validation

Actions availability is not a prerequisite for publishing verified artifacts.
When a workflow cannot run, download the draft's hosted assets into a new empty
directory and run the same repository validators yourself:

```bash
scripts/download-release-assets.sh v<version> /path/to/draft-download
scripts/validate-release.sh /path/to/draft-download
scripts/verify-macos-release.sh /path/to/draft-download/AiRC-<version>-macOS-arm64.zip
```

Run the last command on macOS. Record the successful validator results, full
source revision, artifact inventory and hashes, and native Windows Authenticode
inspection. The Windows release is intentionally unsigned unless separately
authorized otherwise: require `NotSigned` for Setup, desktop and embedded
backend, and `codeSigned: false` in the manifest. An unsigned installer is not
an exception to integrity, upgrade, launch or runtime acceptance.

Only then publish the draft. Download the published assets into another empty
directory, repeat validation, and verify the intended stable Latest release and
updater metadata. An authorized prerelease must not replace stable Latest.
Do not replace failed native checks with hosted-file checks or waive required
gates because Actions is unavailable.

## Source Repository Automation

The private AiRC application repository owns compilation, tests, Apple signing,
and notarization. Its **Publish public desktop release** workflow builds the
requested installers from one source revision, stages them through this
repository's validation scripts, creates a draft release here, and starts this
repository's release-validation workflow.

The private source repository must provide:

- a protected `signing` environment with the Apple signing and notarization secrets;
- an `AIRC_PUBLIC_RELEASE_TOKEN` secret scoped only to creating releases and
  dispatching workflows in this repository; and
- required reviewer approval for the signing environment.

The automation creates a draft, runs the public validation jobs, and publishes
the release only after they pass. A maintainer should still inspect the final
release notes, artifacts, and checksums. The public repository never needs
access to the private source repository.
