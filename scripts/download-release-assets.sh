#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: $0 <release-tag> <output-directory>" >&2
  exit 2
fi

release_tag=$1
output_directory=$2
repository=${GITHUB_REPOSITORY:-AiRC-ai/AiRC-Orchestration}

release_json=$(
  gh api --paginate "repos/$repository/releases?per_page=100" \
    --jq ".[] | select(.tag_name == \"$release_tag\")" \
    | head -n 1
)

if [[ -z $release_json ]]; then
  echo "release not found, including drafts: $release_tag" >&2
  exit 1
fi

mkdir -p "$output_directory"
asset_count=0

while IFS=$'\t' read -r asset_id asset_name; do
  [[ -n $asset_id && -n $asset_name ]] || continue
  if [[ $asset_name == */* || $asset_name == '.' || $asset_name == '..' ]]; then
    echo "unsafe release asset name: $asset_name" >&2
    exit 1
  fi

  gh api \
    -H 'Accept: application/octet-stream' \
    "repos/$repository/releases/assets/$asset_id" \
    >"$output_directory/$asset_name"
  asset_count=$((asset_count + 1))
done < <(printf '%s\n' "$release_json" | jq -r '.assets[] | [.id, .name] | @tsv')

if [[ $asset_count -eq 0 ]]; then
  echo "release has no assets: $release_tag" >&2
  exit 1
fi

echo "downloaded $asset_count assets for $release_tag"
