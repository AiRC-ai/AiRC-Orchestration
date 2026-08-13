#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 5 ]]; then
  echo "usage: $0 <version> <source-commit> <macos-zip> <debian-deb> <output-directory>" >&2
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

for input in "$macos_input" "$debian_input"; do
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

macos_name="AiRC-${version}-macOS-arm64.zip"
debian_name="airc_${version}_amd64.deb"

cp "$macos_input" "$output_directory/$macos_name"
cp "$debian_input" "$output_directory/$debian_name"
cp "$repository_root/LICENSE" "$output_directory/LICENSE"
cp "$repository_root/LICENSES.md" "$output_directory/LICENSES.md"
cp "$repository_root/licenses/Apache-2.0.txt" "$output_directory/APACHE-2.0.txt"
cp "$repository_root/NOTICE" "$output_directory/NOTICE"
cp "$repository_root/THIRD_PARTY_NOTICES.md" "$output_directory/THIRD_PARTY_NOTICES.md"

python3 - "$version" "$source_commit" "$output_directory" "$macos_name" "$debian_name" <<'PY'
import datetime
import hashlib
import json
import pathlib
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


manifest = {
    "schemaVersion": 1,
    "product": "AiRC Orchestration",
    "version": version,
    "sourceCommit": source_commit,
    "publishedAt": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "artifacts": [
        artifact(
            macos_name,
            kind="macos-zip",
            platform="macos",
            architecture="arm64",
            codeSigned=True,
            notarized=True,
        ),
        artifact(
            debian_name,
            kind="debian-deb",
            platform="debian",
            architecture="amd64",
            packageName="airc",
        ),
    ],
}

(root / "release-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
(root / "SHA256SUMS").write_text(
    "".join(f'{item["sha256"]}  {item["fileName"]}\n' for item in manifest["artifacts"])
)
PY

"$repository_root/scripts/validate-release.sh" "$output_directory"

if [[ $(uname -s) == Darwin ]]; then
  "$repository_root/scripts/verify-macos-release.sh" "$output_directory/$macos_name"
fi

echo "staged AiRC $version in $output_directory"
