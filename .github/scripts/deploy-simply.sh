#!/usr/bin/env bash

set -euo pipefail

: "${SIMPLY_SSH_HOST:?SIMPLY_SSH_HOST is required}"
: "${SIMPLY_SSH_USER:?SIMPLY_SSH_USER is required}"
: "${SIMPLY_SSH_PORT:=22}"
: "${SIMPLY_REMOTE_PATH:=public_html}"

remote_path="${SIMPLY_REMOTE_PATH%/}/"
ssh_command="ssh -p ${SIMPLY_SSH_PORT} -o BatchMode=yes"

rsync \
  --archive \
  --compress \
  --delete-delay \
  --human-readable \
  --itemize-changes \
  --exclude='/.git/' \
  --exclude='/.github/' \
  --exclude='/.gitignore' \
  --exclude='/deploy/' \
  --exclude='*.md' \
  --exclude='*.zip' \
  --exclude='*.example.php' \
  --exclude='/contact-config.php' \
  --exclude='/husbil/config.php' \
  --include='/husbil/data/' \
  --include='/husbil/data/.htaccess' \
  --exclude='/husbil/data/***' \
  --include='/mariaochjohan/data/' \
  --include='/mariaochjohan/data/.htaccess' \
  --exclude='/mariaochjohan/data/***' \
  --include='/mariaochjohan/uploads/' \
  --include='/mariaochjohan/uploads/.htaccess' \
  --include='/mariaochjohan/uploads/thumbs/' \
  --include='/mariaochjohan/uploads/thumbs/.htaccess' \
  --exclude='/mariaochjohan/uploads/***' \
  --exclude='/mariaochjohan/google-drive-apps-script.gs' \
  --exclude='/mariaochjohan/tools/' \
  --rsh="$ssh_command" \
  ./ \
  "${SIMPLY_SSH_USER}@${SIMPLY_SSH_HOST}:${remote_path}"
