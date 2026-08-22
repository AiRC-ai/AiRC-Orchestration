# Publishing A Release

This repository is a release boundary. It must receive only final, verified artifacts from the private application source repository.

## Required Artifacts

- `AiRC-<version>-macOS-arm64.zip`
- `airc_<version>_amd64.deb`
- `SHA256SUMS`
- `release-manifest.json`
- `LICENSE`
- `LICENSES.md`
- `APACHE-2.0.txt`
- `NOTICE`
- `THIRD_PARTY_NOTICES.md`

## Release Gates

Before staging a release:

1. Build both installers from the same clean source revision.
2. Run all required Rust and desktop tests in the source repository.
3. Verify application branding and launch behavior on macOS and a clean Debian-family system.
4. Verify clean install and in-place upgrade behavior.
5. Sign and notarize the macOS application with the production identity.
6. Confirm Gatekeeper acceptance and stapled notarization after extracting the final ZIP.
7. Confirm Debian package name `airc`, architecture `amd64`, version, desktop entry, executable, and icon.
8. Confirm the release contains no credentials, logs, user data, source archives, debug symbols, or unsupported package formats.

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

The script renames the macOS archive consistently, generates the manifest and checksums, copies legal notices, and runs cross-platform validation.

On macOS, also run:

```bash
scripts/verify-macos-release.sh /path/to/staging-directory/AiRC-<version>-macOS-arm64.zip
```

## Publish Safely

1. Create a draft GitHub release named `AiRC <version>` with tag `v<version>`.
2. Upload every file from the staging directory.
3. Run the **Validate release** workflow for the draft tag. The workflow uses a narrowly scoped `contents: write` token because GitHub exposes draft releases only to identities with push access; all other workflow permissions remain disabled.
4. Review release notes, checks, file names, sizes, architectures, and checksums.
5. Publish only after both Linux and macOS validation jobs pass.

Do not replace assets on a published release. If an installer changes, issue a new version with new checksums and a new manifest.

## Source Repository Automation

The private AiRC application repository owns compilation, tests, Apple signing,
and notarization. Its **Publish public desktop release** workflow builds the two
supported installers from one source revision, stages them through this
repository's validation scripts, creates a draft release here, and starts this
repository's release-validation workflow.

The private source repository must provide:

- a protected `signing` environment with the Apple signing and notarization secrets;
- an `AIRC_PUBLIC_RELEASE_TOKEN` secret scoped only to creating releases and
  dispatching workflows in this repository; and
- required reviewer approval for the signing environment.

The automation creates a draft, runs both public validation jobs, and publishes
the release only after they pass. A maintainer should still inspect the final
release notes, artifacts, and checksums. The public repository never needs
access to the private source repository.
