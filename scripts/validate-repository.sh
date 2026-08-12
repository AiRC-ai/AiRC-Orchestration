#!/usr/bin/env bash
set -euo pipefail

repository_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repository_root"

required_files=(
  README.md
  LICENSE
  NOTICE
  THIRD_PARTY_NOTICES.md
  SECURITY.md
  SUPPORT.md
  CONTRIBUTING.md
  docs/INSTALL.md
  docs/VERIFY.md
  docs/PUBLISHING.md
  release-manifest.schema.json
  scripts/stage-release.sh
  scripts/test-release-validation.sh
  scripts/validate-release.sh
  scripts/validate-repository.sh
  scripts/verify-macos-release.sh
  .github/workflows/validate-release.yml
  .github/workflows/validate-repository.yml
)

for file in "${required_files[@]}"; do
  [[ -f $file ]] || { echo "missing repository file: $file" >&2; exit 1; }
done

if find . -path ./.git -prune -o -type f \( \
  -name '*.zip' -o -name '*.deb' -o -name '*.dmg' -o -name '*.pkg' -o \
  -name '*.rpm' -o -name '*.AppImage' -o -name '*.exe' -o -name '*.msi' \
\) -print -quit | grep -q .; then
  echo "compiled installers belong in GitHub Releases, not git history" >&2
  exit 1
fi

if rg -n --hidden \
  --glob '!.git/**' \
  --glob '!scripts/validate-repository.sh' \
  '(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' .; then
  echo "possible credential material found" >&2
  exit 1
fi

python3 -m json.tool release-manifest.schema.json >/dev/null

if rg -n -i 'derived from goose|honk|goose is working' README.md docs SUPPORT.md SECURITY.md CONTRIBUTING.md; then
  echo "public-facing branding regression found" >&2
  exit 1
fi

echo "repository validation passed"
