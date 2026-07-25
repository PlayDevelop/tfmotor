#!/usr/bin/env bash

set -euo pipefail

bump="${1:-patch}"
latest="$(git tag --list 'v[0-9]*.[0-9]*.[0-9]*' --sort=-version:refname | head -n 1)"

if [[ -z "$latest" ]]; then
  echo 'v1.0.0'
  exit 0
fi

if [[ ! "$latest" =~ ^v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "Invalid release tag: $latest" >&2
  exit 1
fi

major="${BASH_REMATCH[1]}"
minor="${BASH_REMATCH[2]}"
patch="${BASH_REMATCH[3]}"

case "$bump" in
  major)
    major=$((major + 1))
    minor=0
    patch=0
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    ;;
  patch)
    patch=$((patch + 1))
    ;;
  *)
    echo "Unknown version bump: $bump" >&2
    exit 1
    ;;
esac

echo "v${major}.${minor}.${patch}"
