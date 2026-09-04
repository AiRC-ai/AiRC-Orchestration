#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <release-directory>" >&2
  exit 2
fi

release_directory=$1
repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

if [[ ! -d $release_directory ]]; then
  echo "release directory does not exist: $release_directory" >&2
  exit 1
fi

release_directory=$(cd "$release_directory" && pwd)

for required_file in SHA256SUMS release-manifest.json LICENSE LICENSES.md APACHE-2.0.txt NOTICE THIRD_PARTY_NOTICES.md; do
  if [[ ! -f "$release_directory/$required_file" ]]; then
    echo "missing release file: $required_file" >&2
    exit 1
  fi
done

grep -Fq 'AiRC ORCHESTRATION PROPRIETARY BETA LICENSE' "$release_directory/LICENSE" || {
  echo "release is missing the AiRC proprietary license terms" >&2
  exit 1
}
grep -Fq 'Apache License' "$release_directory/APACHE-2.0.txt" || {
  echo "release is missing the retained Apache license terms" >&2
  exit 1
}
grep -Fq 'Original AiRC code, modifications' "$release_directory/LICENSES.md" || {
  echo "release license map does not identify AiRC-owned materials" >&2
  exit 1
}
grep -Fq 'Components originally distributed under Apache License 2.0' "$release_directory/LICENSES.md" || {
  echo "release license map does not identify inherited components" >&2
  exit 1
}

mapfile_compat() {
  local pattern=$1
  find "$release_directory" -maxdepth 1 -type f -name "$pattern" -print | sort
}

macos_files=$(mapfile_compat 'AiRC-*-macOS-arm64.zip')
debian_files=$(mapfile_compat 'airc_*_amd64.deb')

macos_count=$(printf '%s\n' "$macos_files" | sed '/^$/d' | wc -l | tr -d ' ')
debian_count=$(printf '%s\n' "$debian_files" | sed '/^$/d' | wc -l | tr -d ' ')

if [[ $macos_count -gt 1 ]]; then
  echo "release may contain at most one macOS arm64 ZIP" >&2
  exit 1
fi

if [[ $debian_count -gt 1 ]]; then
  echo "release may contain at most one Debian amd64 package" >&2
  exit 1
fi

if [[ $((macos_count + debian_count)) -eq 0 ]]; then
  echo "release must contain at least one installer" >&2
  exit 1
fi

macos_file=$(printf '%s\n' "$macos_files" | sed '/^$/d')
debian_file=$(printf '%s\n' "$debian_files" | sed '/^$/d')

allowed_files=$(
  {
    [[ -n $macos_file ]] && basename "$macos_file"
    [[ -n $macos_file ]] && printf '%s\n' latest-mac.yml
    [[ -n $debian_file ]] && basename "$debian_file"
    printf '%s\n' LICENSE LICENSES.md APACHE-2.0.txt NOTICE SHA256SUMS \
      THIRD_PARTY_NOTICES.md release-manifest.json
  } | sort
)
actual_files=$(find "$release_directory" -maxdepth 1 -type f -exec basename {} \; | sort)

if [[ $actual_files != "$allowed_files" ]]; then
  echo "release files do not match the public distribution contract" >&2
  diff -u <(printf '%s\n' "$allowed_files") <(printf '%s\n' "$actual_files") >&2 || true
  exit 1
fi

(
  cd "$release_directory"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c SHA256SUMS
  else
    shasum -a 256 -c SHA256SUMS
  fi
)

python3 - "$release_directory" "$repository_root/release-manifest.schema.json" <<'PY'
import hashlib
import base64
import json
import pathlib
import re
import sys
import zipfile
from datetime import datetime

root = pathlib.Path(sys.argv[1])
manifest = json.loads((root / "release-manifest.json").read_text())

required = {"schemaVersion", "product", "version", "sourceCommit", "publishedAt", "artifacts"}
if set(manifest) != required:
    raise SystemExit(f"manifest keys do not match schema: {sorted(set(manifest) ^ required)}")
if manifest["schemaVersion"] != 1 or manifest["product"] != "AiRC Orchestration":
    raise SystemExit("manifest product or schema version is invalid")
if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:[+-][0-9A-Za-z.-]+)?", manifest["version"]):
    raise SystemExit("manifest version is invalid")
if not re.fullmatch(r"[0-9a-f]{40}", manifest["sourceCommit"]):
    raise SystemExit("manifest source commit is invalid")
try:
    published_at = datetime.fromisoformat(manifest["publishedAt"].replace("Z", "+00:00"))
except (TypeError, ValueError):
    raise SystemExit("manifest publication timestamp is invalid")
if published_at.tzinfo is None:
    raise SystemExit("manifest publication timestamp must include a timezone")

artifacts = manifest["artifacts"]
if not 1 <= len(artifacts) <= 2:
    raise SystemExit("manifest must contain one or two artifacts")

by_kind = {item.get("kind"): item for item in artifacts}
if len(by_kind) != len(artifacts) or not set(by_kind) <= {"macos-zip", "debian-deb"}:
    raise SystemExit("manifest contains duplicate or unsupported artifact kinds")

mac = by_kind.get("macos-zip")
deb = by_kind.get("debian-deb")
if mac and (
    mac.get("platform"), mac.get("architecture"), mac.get("codeSigned"), mac.get("notarized")
) != ("macos", "arm64", True, True):
    raise SystemExit("macOS signing or architecture metadata is invalid")
if deb and (deb.get("platform"), deb.get("architecture"), deb.get("packageName")) != (
    "debian", "amd64", "airc"
):
    raise SystemExit("Debian package metadata is invalid")

expected_names = set()
if mac:
    expected_names.add(f'AiRC-{manifest["version"]}-macOS-arm64.zip')
if deb:
    expected_names.add(f'airc_{manifest["version"]}_amd64.deb')
if {item.get("fileName") for item in artifacts} != expected_names:
    raise SystemExit("artifact names do not match manifest version")

for item in artifacts:
    expected_keys = {
        "macos-zip": {
            "kind", "platform", "architecture", "fileName", "size", "sha256",
            "codeSigned", "notarized",
        },
        "debian-deb": {
            "kind", "platform", "architecture", "fileName", "size", "sha256",
            "packageName",
        },
    }[item["kind"]]
    if set(item) != expected_keys:
        raise SystemExit(f"unexpected manifest fields for {item['kind']}")
    path = root / item["fileName"]
    if not path.is_file():
        raise SystemExit(f"missing artifact: {item['fileName']}")
    if item.get("size") != path.stat().st_size:
        raise SystemExit(f"size mismatch: {item['fileName']}")
    digest = hashlib.sha256()
    with path.open("rb") as artifact_file:
        for chunk in iter(lambda: artifact_file.read(1024 * 1024), b""):
            digest.update(chunk)
    digest = digest.hexdigest()
    if item.get("sha256") != digest:
        raise SystemExit(f"hash mismatch: {item['fileName']}")

checksum_lines = {
    line.split(maxsplit=1)[1].strip(): line.split(maxsplit=1)[0]
    for line in (root / "SHA256SUMS").read_text().splitlines()
    if line.strip()
}
if checksum_lines != {item["fileName"]: item["sha256"] for item in artifacts}:
    raise SystemExit("SHA256SUMS does not exactly match manifest artifacts")

if mac:
    mac_archive = root / mac["fileName"]
    with zipfile.ZipFile(mac_archive) as archive:
        names = archive.namelist()
        if not names or not any(name.startswith("AiRC.app/") for name in names):
            raise SystemExit("macOS ZIP does not contain a top-level AiRC.app")
        for name in names:
            path = pathlib.PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts:
                raise SystemExit(f"unsafe path in macOS ZIP: {name}")
            if path.parts and path.parts[0] != "AiRC.app":
                raise SystemExit(f"unexpected top-level path in macOS ZIP: {name}")

    version_match = re.fullmatch(
        r"(\d+)\.(\d+)\.(\d+)\+airc(\d+)", manifest["version"], re.IGNORECASE
    )
    if not version_match:
        raise SystemExit("macOS updater metadata requires an AiRC release version")
    major, minor, patch, airc_revision = (int(part) for part in version_match.groups())
    if airc_revision >= 100_000:
        raise SystemExit("AiRC release revision is too large for the macOS updater")
    native_version = f"{major}.{minor}.{patch * 100_000 + airc_revision}"
    sha512_digest = hashlib.sha512()
    with mac_archive.open("rb") as artifact_file:
        for chunk in iter(lambda: artifact_file.read(1024 * 1024), b""):
            sha512_digest.update(chunk)
    sha512 = base64.b64encode(sha512_digest.digest()).decode("ascii")

    def yaml_string(value):
        return json.dumps(str(value))

    expected_update_manifest = "\n".join(
        [
            f"version: {yaml_string(native_version)}",
            "files:",
            f"  - url: {yaml_string(mac['fileName'])}",
            f"    sha512: {yaml_string(sha512)}",
            f"    size: {mac_archive.stat().st_size}",
            f"path: {yaml_string(mac['fileName'])}",
            f"sha512: {yaml_string(sha512)}",
            f"releaseName: {yaml_string(manifest['version'])}",
            f"releaseDate: {yaml_string(manifest['publishedAt'])}",
            "",
        ]
    )
    update_manifest_path = root / "latest-mac.yml"
    if not update_manifest_path.is_file():
        raise SystemExit("macOS release is missing latest-mac.yml")
    if update_manifest_path.read_text() != expected_update_manifest:
        raise SystemExit("latest-mac.yml does not exactly match the macOS artifact")
PY

if [[ -n $debian_file ]] && command -v dpkg-deb >/dev/null 2>&1; then
  package_name=$(dpkg-deb -f "$debian_file" Package)
  package_architecture=$(dpkg-deb -f "$debian_file" Architecture)
  package_version=$(dpkg-deb -f "$debian_file" Version)
  package_maintainer=$(dpkg-deb -f "$debian_file" Maintainer)
  package_homepage=$(dpkg-deb -f "$debian_file" Homepage)
  manifest_version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$release_directory/release-manifest.json")

  [[ $package_name == airc ]] || { echo "unexpected Debian package name: $package_name" >&2; exit 1; }
  [[ $package_architecture == amd64 ]] || { echo "unexpected Debian architecture: $package_architecture" >&2; exit 1; }
  [[ $package_version == "$manifest_version" ]] || { echo "Debian version does not match manifest" >&2; exit 1; }
  [[ $package_maintainer == AiRC* ]] || { echo "unexpected Debian maintainer: $package_maintainer" >&2; exit 1; }
  [[ $package_homepage == https://github.com/AiRC-ai/AiRC-Orchestration ]] || { echo "unexpected Debian homepage: $package_homepage" >&2; exit 1; }

  debian_root=$(mktemp -d)
  trap 'rm -rf "$debian_root"' EXIT
  dpkg-deb -x "$debian_file" "$debian_root"

  desktop_entry="$debian_root/usr/share/applications/airc.desktop"
  launcher="$debian_root/usr/lib/airc/airc"
  icon="$debian_root/usr/share/pixmaps/airc.png"

  [[ -f $desktop_entry ]] || { echo "Debian package is missing airc.desktop" >&2; exit 1; }
  [[ -x $launcher ]] || { echo "Debian package is missing the executable AiRC launcher" >&2; exit 1; }
  [[ -s $icon ]] || { echo "Debian package is missing the AiRC icon" >&2; exit 1; }

  for expected_entry in \
    'Name=AiRC' \
    'Exec=/usr/lib/airc/airc %U' \
    'Icon=/usr/share/pixmaps/airc.png' \
    'StartupWMClass=AiRC' \
    'MimeType=x-scheme-handler/airc;x-scheme-handler/goose;'; do
    grep -Fxq "$expected_entry" "$desktop_entry" || {
      echo "Debian desktop entry is missing: $expected_entry" >&2
      exit 1
    }
  done
fi

echo "release validation passed"
