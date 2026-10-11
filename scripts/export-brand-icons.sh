#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source_icon="docs/branding/coaster2stl-icon-master.png"

# Keep the master's square framing and transparency at every display size.
export_icon() {
  local size="$1"
  local destination="$2"
  magick "$source_icon" -resize "${size}x${size}" -strip \
    -define png:compression-level=9 "PNG32:$destination"
}

export_icon 256 public/coaster2stl-logo.png
export_icon 16 public/favicon-16.png
export_icon 32 public/favicon-32.png
export_icon 48 public/favicon-48.png
export_icon 64 public/favicon.png
export_icon 192 public/icon-192.png
export_icon 512 public/icon-512.png
export_icon 180 public/apple-touch-icon.png
magick public/apple-touch-icon.png -background '#f7f4f1' -alpha remove -alpha off \
  -strip public/apple-touch-icon.png
magick public/favicon-16.png public/favicon-32.png public/favicon-48.png public/favicon.ico
