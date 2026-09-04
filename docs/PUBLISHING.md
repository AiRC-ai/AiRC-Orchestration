# Publishing A Release

This repository is a release boundary. It must receive only final, verified artifacts from the private application source repository.

## Release Artifacts

- `AiRC-<version>-macOS-arm64.zip` when publishing macOS
- `latest-mac.yml` when publishing macOS; generated from the exact notarized ZIP
- `airc_<version>_amd64.deb` when publishing Debian
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
9. Confirm the release contains no credentials, logs, user data, source archives, debug symbols, or unsupported package formats.

## Stage The Release

From this repository:

```bash
scripts/stage-release.sh \
  <version> \
  <40-character-source-commit> \
  /path/to/AiRC.zip \
  /path/to/airc_<version>_amd64.deb \
  /path/to/staging-directory
```

The script renames the macOS archive consistently, generates the release manifest,
checksums, and signed-update feed metadata, copies legal notices, and runs
cross-platform validation. The updater metadata uses a monotonically increasing
native macOS version while retaining the full `+aircNN` release name for display.

Use `-` for a platform that is not included. For example, a macOS-only release
passes `/path/to/AiRC.zip -` for the two installer arguments. At least one
installer is always required.

On macOS, also run:

```bash
scripts/verify-macos-release.sh /path/to/staging-directory/AiRC-<version>-macOS-arm64.zip
```

## Publish Safely

1. Create a draft GitHub release named `AiRC <version>` with tag `v<version>`.
2. Upload every file from the staging directory.
3. Run the **Validate release** workflow for the draft tag. The workflow uses a narrowly scoped `contents: write` token because GitHub exposes draft releases only to identities with push access; all other workflow permissions remain disabled.
4. Review release notes, checks, file names, sizes, architectures, and checksums.
5. Publish only after validation passes for every installer included in the release.

Do not replace assets on a published release. If an installer changes, issue a new version with new checksums and a new manifest.

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
