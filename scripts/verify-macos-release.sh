#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "usage: $0 <AiRC-macOS.zip> [arm64|x64]" >&2
  exit 2
fi

archive=$1
expected_architecture=${2:-arm64}
case "$expected_architecture" in
  arm64) native_architecture=arm64 ;;
  x64) native_architecture=x86_64 ;;
  *) echo "unsupported macOS architecture: $expected_architecture" >&2; exit 2 ;;
esac
if [[ ! -f $archive ]]; then
  echo "missing macOS archive: $archive" >&2
  exit 1
fi

if [[ $(uname -s) != Darwin ]]; then
  echo "macOS release verification must run on macOS" >&2
  exit 1
fi

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

ditto -x -k "$archive" "$temporary_directory"
application="$temporary_directory/AiRC.app"
info_plist="$application/Contents/Info.plist"

if [[ ! -d $application ]]; then
  echo "archive does not contain a top-level AiRC.app" >&2
  exit 1
fi

if [[ ! -f $info_plist ]]; then
  echo "AiRC.app is missing Contents/Info.plist" >&2
  exit 1
fi


bundle_name=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$info_plist")
display_name=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleDisplayName' "$info_plist")
bundle_identifier=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$info_plist")
bundle_executable=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$info_plist")

if [[ $bundle_name != AiRC || $display_name != AiRC ]]; then
  echo "macOS bundle name is not AiRC" >&2
  exit 1
fi

if [[ $bundle_identifier != com.electron.airc ]]; then
  echo "unexpected macOS bundle identifier: $bundle_identifier" >&2
  exit 1
fi

if [[ $bundle_executable != airc ]]; then
  echo "unexpected macOS executable name: $bundle_executable" >&2
  exit 1
fi

executable="$application/Contents/MacOS/$bundle_executable"
if [[ ! -x $executable ]]; then
  echo "macOS executable is missing or not executable: $executable" >&2
  exit 1
fi

signing_details=$(codesign -dvv "$application" 2>&1)
if ! grep -q '^Authority=Developer ID Application:' <<<"$signing_details"; then
  echo "AiRC.app is not signed with a Developer ID Application certificate" >&2
  exit 1
fi

if ! grep -Eq '^TeamIdentifier=.+$' <<<"$signing_details"; then
  echo "AiRC.app signature does not include an Apple Developer team identifier" >&2
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$application"
spctl --assess --type execute --verbose=2 "$application"
xcrun stapler validate "$application"

python3 - "$application" "$native_architecture" <<'PYARCH'
import os
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
expected = sys.argv[2]
checked = 0
for directory, _, names in os.walk(root, followlinks=False):
    for name in names:
        path = Path(directory) / name
        if path.is_symlink():
            continue
        with path.open('rb') as stream:
            header = stream.read(8)
        if header[:4] in [bytes.fromhex(x) for x in ['feedface', 'cefaedfe', 'feedfacf', 'cffaedfe']]:
            native = True
        else:
            native = header[:4] in [bytes.fromhex('cafebabe'), bytes.fromhex('cafebabf')] and 1 <= int.from_bytes(header[4:8], 'big') <= 8
        if not native:
            continue
        arches = subprocess.check_output(['/usr/bin/lipo', '-archs', str(path)], text=True).split()
        if expected not in arches:
            raise SystemExit(f"macOS component architecture mismatch: {path.relative_to(root)}; expected {expected}, found {arches}")
        checked += 1
if checked < 4:
    raise SystemExit('macOS archive is missing expected native runtime components')
print(f'Verified {checked} native components contain {expected}')
PYARCH

echo "macOS signing, notarization, and architecture verification passed"
