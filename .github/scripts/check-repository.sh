#!/usr/bin/env bash

set -euo pipefail

echo "Checking JavaScript syntax"
while IFS= read -r -d '' file; do
  node --check "$file"
done < <(
  find . -type f \( -name '*.js' -o -name '*.cjs' \) \
    -not -path './.git/*' \
    -not -path './deploy/*' \
    -print0
)

echo "Checking PHP syntax"
while IFS= read -r -d '' file; do
  php -l "$file"
done < <(
  find . -type f -name '*.php' \
    -not -path './.git/*' \
    -not -path './deploy/*' \
    -print0
)

echo "Checking for production-only files"
forbidden_files=(
  'contact-config.php'
  'husbil/config.php'
  'husbil/data/husbil.sqlite'
  'mariaochjohan/data/photos.json'
)

for file in "${forbidden_files[@]}"; do
  if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    echo "::error file=$file::Production data must not be committed."
    exit 1
  fi
done

if git ls-files | grep -Eq '(^deploy/|^mariaochjohan/uploads/.+\.(jpe?g|png|webp|heic|heif)$)'; then
  echo "::error::Deployment archives or guest uploads must not be committed."
  exit 1
fi

echo "Repository checks passed"
