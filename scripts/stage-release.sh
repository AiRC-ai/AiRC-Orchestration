#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "usage: $0 <version> <source-commit> <macos-zip-or-> <debian-deb-or-> <output-directory>" >&2
  exit 2
fi

version=$1
source_commit=$2
macos_input=$3
debian_input=$4
output_directory=$5

if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]]; then
  echo "invalid version: $version" >&2
  exit 1
fi

if [[ ! $source_commit =~ ^[0-9a-f]{40}$ ]]; then
  echo "source commit must be a full 40-character lowercase Git SHA" >&2
  exit 1
fi

if [[ $macos_input == - && $debian_input == - ]]; then
  echo "at least one release input is required" >&2
  exit 1
fi

for input in "$macos_input" "$debian_input"; do
  [[ $input == - ]] && continue
  if [[ ! -f $input ]]; then
    echo "missing release input: $input" >&2
    exit 1
  fi
done

if [[ -e $output_directory ]] && [[ -n $(find "$output_directory" -mindepth 1 -maxdepth 1 -print -quit) ]]; then
  echo "output directory must be empty: $output_directory" >&2
  exit 1
fi

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
mkdir -p "$output_directory"
output_directory=$(cd "$output_directory" && pwd)

macos_name=''
debian_name=''

if [[ $macos_input != - ]]; then
  macos_name="AiRC-${version}-macOS-arm64.zip"
  cp "$macos_input" "$output_directory/$macos_name"
fi
if [[ $debian_input != - ]]; then
  debian_name="airc_${version}_amd64.deb"
  cp "$debian_input" "$output_directory/$debian_name"
fi
cp "$repository_root/LICENSE" "$output_directory/LICENSE"
cp "$repository_root/LICENSES.md" "$output_directory/LICENSES.md"
cp "$repository_root/licenses/Apache-2.0.txt" "$output_directory/APACHE-2.0.txt"
cp "$repository_root/NOTICE" "$output_directory/NOTICE"
cp "$repository_root/THIRD_PARTY_NOTICES.md" "$output_directory/THIRD_PARTY_NOTICES.md"

python3 - "$version" "$source_commit" "$output_directory" "$macos_name" "$debian_name" <<'PY'
import datetime
import base64
import hashlib
import json
import pathlib
import re
import sys

version, source_commit, output_directory, macos_name, debian_name = sys.argv[1:]
root = pathlib.Path(output_directory)


def artifact(file_name, **metadata):
    path = root / file_name
    digest = hashlib.sha256()
    with path.open("rb") as artifact_file:
        for chunk in iter(lambda: artifact_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        **metadata,
        "fileName": file_name,
        "size": path.stat().st_size,
        "sha256": digest.hexdigest(),
    }


artifacts = []
published_at = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
if macos_name:
    artifacts.append(
        artifact(
            macos_name,
            kind="macos-zip",
            platform="macos",
            architecture="arm64",
            codeSigned=True,
            notarized=True,
        )
    )
if debian_name:
    artifacts.append(
        artifact(
            debian_name,
            kind="debian-deb",
            platform="debian",
            architecture="amd64",
            packageName="airc",
        )
    )

manifest = {
    "schemaVersion": 1,
    "product": "AiRC Orchestration",
    "version": version,
    "sourceCommit": source_commit,
    "publishedAt": published_at,
    "artifacts": artifacts,
}

(root / "release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(root / "SHA256SUMS").write_text(
    "".join(f'{item["sha256"]}  {item["fileName"]}\n' for item in manifest["artifacts"])
)

if macos_name:
    version_match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)\+airc(\d+)", version, re.IGNORECASE)
    if not version_match:
        raise SystemExit("macOS releases require an AiRC version such as 1.45.0+airc85")
    major, minor, patch, airc_revision = (int(part) for part in version_match.groups())
    if airc_revision >= 100_000:
        raise SystemExit("AiRC release revision is too large for the macOS updater")
    native_version = f"{major}.{minor}.{patch * 100_000 + airc_revision}"
    archive_path = root / macos_name
    digest = hashlib.sha512()
    with archive_path.open("rb") as artifact_file:
        for chunk in iter(lambda: artifact_file.read(1024 * 1024), b""):
            digest.update(chunk)
    sha512 = base64.b64encode(digest.digest()).decode("ascii")

    def yaml_string(value):
        return json.dumps(str(value))

    update_manifest = "\n".join(
        [
            f"version: {yaml_string(native_version)}",
            "files:",
            f"  - url: {yaml_string(macos_name)}",
            f"    sha512: {yaml_string(sha512)}",
            f"    size: {archive_path.stat().st_size}",
            f"path: {yaml_string(macos_name)}",
            f"sha512: {yaml_string(sha512)}",
            f"releaseName: {yaml_string(version)}",
            f"releaseDate: {yaml_string(published_at)}",
            "",
        ]
    )
    (root / "latest-mac.yml").write_text(update_manifest)
PY

"$repository_root/scripts/validate-release.sh" "$output_directory"

if [[ $(uname -s) == Darwin && -n $macos_name ]]; then
  "$repository_root/scripts/verify-macos-release.sh" "$output_directory/$macos_name"
fi

echo "staged AiRC $version in $output_directory"
