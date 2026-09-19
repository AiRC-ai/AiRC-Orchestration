#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

for command in dpkg-deb python3 zip; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "required test command is unavailable: $command" >&2
    exit 1
  fi
done

temporary_directory=$(mktemp -d)
trap 'rm -rf "$temporary_directory"' EXIT

version=1.45.0+airc999
source_commit=0123456789abcdef0123456789abcdef01234567
macos_fixture="$temporary_directory/AiRC.zip"
debian_fixture="$temporary_directory/airc.deb"
windows_fixture="$temporary_directory/AiRC-Setup.exe"
application_root="$temporary_directory/macos/AiRC.app/Contents"
package_root="$temporary_directory/debian"
staging_directory="$temporary_directory/staging"
macos_staging_directory="$temporary_directory/macos-staging"
invalid_windows_staging_directory="$temporary_directory/invalid-windows-staging"
invalid_windows_fixture="$temporary_directory/invalid-setup.exe"

mkdir -p "$application_root/MacOS" \
  "$package_root/DEBIAN" \
  "$package_root/usr/lib/airc" \
  "$package_root/usr/share/applications" \
  "$package_root/usr/share/pixmaps"

printf '#!/usr/bin/env bash\nexit 0\n' > "$application_root/MacOS/airc"
chmod 0755 "$application_root/MacOS/airc"
(
  cd "$temporary_directory/macos"
  zip -qr "$macos_fixture" AiRC.app
)

python3 - "$windows_fixture" <<'PY'
import pathlib
import sys

data = bytearray(128)
data[0:2] = b"MZ"
data[0x3C:0x40] = (64).to_bytes(4, "little")
data[64:68] = b"PE\0\0"
pathlib.Path(sys.argv[1]).write_bytes(data)
PY
printf 'MZ-not-a-portable-executable\n' > "$invalid_windows_fixture"

cat > "$package_root/DEBIAN/control" <<EOF
Package: airc
Version: $version
Architecture: amd64
Maintainer: AiRC <support@airc.ai>
Homepage: https://github.com/AiRC-ai/AiRC-Orchestration
Description: AiRC Orchestration validation fixture
EOF

printf '#!/usr/bin/env bash\nexit 0\n' > "$package_root/usr/lib/airc/airc"
chmod 0755 "$package_root/usr/lib/airc/airc"
cat > "$package_root/usr/share/applications/airc.desktop" <<'EOF'
[Desktop Entry]
Name=AiRC
Exec=/usr/lib/airc/airc %U
Icon=/usr/share/pixmaps/airc.png
StartupWMClass=AiRC
Terminal=false
Type=Application
Categories=Development;
MimeType=x-scheme-handler/airc;x-scheme-handler/goose;
EOF
printf 'AiRC fixture icon\n' > "$package_root/usr/share/pixmaps/airc.png"
dpkg-deb --build --root-owner-group "$package_root" "$debian_fixture" >/dev/null

if [[ $(uname -s) == Darwin ]]; then
  if "$repository_root/scripts/stage-release.sh" \
    "$version" "$source_commit" "$macos_fixture" "$debian_fixture" "$windows_fixture" "$staging_directory" \
    >/dev/null 2>&1; then
    echo "unsigned macOS fixture unexpectedly passed native release verification" >&2
    exit 1
  fi
  "$repository_root/scripts/validate-release.sh" "$staging_directory" >/dev/null
else
  "$repository_root/scripts/stage-release.sh" \
    "$version" "$source_commit" "$macos_fixture" "$debian_fixture" "$windows_fixture" "$staging_directory" \
    >/dev/null
fi

if [[ $(uname -s) == Darwin ]]; then
  if "$repository_root/scripts/stage-release.sh" \
    "$version" "$source_commit" "$macos_fixture" - - "$macos_staging_directory" \
    >/dev/null 2>&1; then
    echo "unsigned macOS-only fixture unexpectedly passed native release verification" >&2
    exit 1
  fi
  "$repository_root/scripts/validate-release.sh" "$macos_staging_directory" >/dev/null
else
  "$repository_root/scripts/stage-release.sh" \
    "$version" "$source_commit" "$macos_fixture" - - "$macos_staging_directory" \
    >/dev/null
fi

if find "$macos_staging_directory" -maxdepth 1 -type f -name '*.deb' -print -quit | grep -q .; then
  echo "macOS-only release unexpectedly contains a Debian package" >&2
  exit 1
fi

if ! find "$staging_directory" -maxdepth 1 -type f -name '*-Setup.exe' -print -quit | grep -q .; then
  echo "release staging is missing the Windows installer" >&2
  exit 1
fi

if find "$macos_staging_directory" -maxdepth 1 -type f -name '*-Setup.exe' -print -quit | grep -q .; then
  echo "macOS-only release unexpectedly contains a Windows installer" >&2
  exit 1
fi

if [[ ! -f "$macos_staging_directory/latest-mac.yml" ]]; then
  echo "macOS-only release is missing updater metadata" >&2
  exit 1
fi

if "$repository_root/scripts/stage-release.sh" \
  "$version" "$source_commit" - - "$invalid_windows_fixture" "$invalid_windows_staging_directory" \
  >/dev/null 2>&1; then
  echo "release staging accepted a malformed Windows installer" >&2
  exit 1
fi

printf 'unexpected file\n' > "$staging_directory/debug.txt"
if "$repository_root/scripts/validate-release.sh" "$staging_directory" >/dev/null 2>&1; then
  echo "release validator accepted an unexpected file" >&2
  exit 1
fi
rm "$staging_directory/debug.txt"

mv "$staging_directory/latest-mac.yml" "$temporary_directory/latest-mac.yml"
if "$repository_root/scripts/validate-release.sh" "$staging_directory" >/dev/null 2>&1; then
  echo "release validator accepted missing macOS updater metadata" >&2
  exit 1
fi
mv "$temporary_directory/latest-mac.yml" "$staging_directory/latest-mac.yml"

cp "$staging_directory/latest-mac.yml" "$temporary_directory/latest-mac.yml"
python3 - "$staging_directory/latest-mac.yml" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
content = path.read_text()
path.write_text(content.replace('sha512: "', 'sha512: "tampered-', 1))
PY
if "$repository_root/scripts/validate-release.sh" "$staging_directory" >/dev/null 2>&1; then
  echo "release validator accepted tampered macOS updater metadata" >&2
  exit 1
fi
mv "$temporary_directory/latest-mac.yml" "$staging_directory/latest-mac.yml"

cp "$staging_directory/AiRC-${version}-Setup.exe" "$temporary_directory/AiRC-Setup.exe.copy"
printf 'tampered\n' >> "$staging_directory/AiRC-${version}-Setup.exe"
if "$repository_root/scripts/validate-release.sh" "$staging_directory" >/dev/null 2>&1; then
  echo "release validator accepted a tampered Windows installer" >&2
  exit 1
fi
mv "$temporary_directory/AiRC-Setup.exe.copy" "$staging_directory/AiRC-${version}-Setup.exe"

printf 'tampered\n' >> "$staging_directory/airc_${version}_amd64.deb"
if "$repository_root/scripts/validate-release.sh" "$staging_directory" >/dev/null 2>&1; then
  echo "release validator accepted a tampered artifact" >&2
  exit 1
fi

echo "release validation self-test passed"
