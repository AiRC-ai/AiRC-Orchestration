#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 <AiRC-macOS-arm64.zip>" >&2
  exit 2
fi

archive=$1
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

if [[ $(/usr/bin/uname -m) != arm64 ]]; then
  echo "macOS release verification requires an Apple silicon runner" >&2
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

executable_architectures=$(lipo -archs "$executable")
if [[ $executable_architectures != *arm64* ]]; then
  echo "AiRC executable does not contain arm64" >&2
  exit 1
fi

echo "macOS signing, notarization, and architecture verification passed"
