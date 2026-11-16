# AiRC 1.45.0+airc147

This desktop update adds the authenticated, direct provider route used by the
upcoming native Local + Remote companion. Selecting a computer model in Local
chat uses that provider without starting an agent, tool, project or Remote task.
Provider credentials stay on the computer. The phone update is distributed
separately through Apple.

Both Mac downloads are Developer ID signed and notarized. Choose `arm64` for
Apple silicon or `x64` for Intel. The Intel version can be compiled on Apple
silicon; its installed runtime was independently tested on a native Intel Mac
runner. The Debian package is `amd64`. The unsigned Windows candidate remains
withheld from this release pending its separate installer and signing gates.

## Source and artifact identity

The full application revision is `1f9db05ee66d73f8b353f627639a6b620b5289cf`.
The version is `1.45.0+airc147`; the Mac bundle version is `1.45.147`.

| Artifact | SHA-256 |
| --- | --- |
| `AiRC-1.45.0+airc147-macOS-arm64.zip` | `b04ad4101b158b81ee26a52df1078f104dcf111d35679609827a58a72a963102` |
| `AiRC-1.45.0+airc147-macOS-x64.zip` | `6e0703a6bf9df5aa277fdea47569691135b98a95099fb14f42fc793edb1ae57e` |
| `airc_1.45.0+airc147_amd64.deb` | `08b193a3ef0a9ee77ab3b6a320d3b688173b719d6ef1edcc4eb3f6517c5b237d` |

Use the matching release manifest, checksums, licenses and update feed from the
same release. Both Mac update paths identify these same verified archives.

## Verification scope

- Apple silicon: final signed archive, staged runtime and installed application;
  146-to-147 upgrade with preserved application data; full 4,000-message lifecycle
  and native terminal output/exit verification.
- Intel: final archive architecture, nested signatures, notarization and native
  backend startup; full installed `/Applications/AiRC.app` lifecycle on a native
  Intel runner with 4,000 messages, native terminal, single-send persistence,
  workflow/automation recovery, repeated renderer crashes and rapid-crash limits.
  See the [native Intel verification run](https://github.com/AiRC-ai/AiRC-Orchestration/actions/runs/43851043326).
- Debian: 146-to-147 installed upgrade, full 4,000-message lifecycle, clean package
  removal/reinstallation and normal launch with existing profiles preserved.
- Direct 145-to-147 migration: 4,000-message fixture and stored-table preservation.
- Hosted release structure and download checks cover both Mac architectures,
  Debian and the Windows manifest. The Windows manifest job does not qualify a
  Windows installer that is not included.

Verification uses isolated synthetic data. It does not access customer profiles
or credentials. Failed local Rosetta attempts were not accepted as Intel proof;
the successful native Intel run supplies that separate qualification.

Finish active work before installing or selecting Install & Restart. Keep a
profile/configuration backup and the previous installer until the upgrade is
accepted. Earlier releases remain available with their matching backups.
