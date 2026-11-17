#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-zigorminsk-debug/zicode}"
KEYSTORE_FILE="$(cd "$(dirname "$0")/.." && pwd)/android/keystores/zicode-release.p12"

if [ ! -f "$KEYSTORE_FILE" ]; then
  echo "Error: Keystore not found at $KEYSTORE_FILE"
  exit 1
fi

echo "Encoding persistent Android keystore ($KEYSTORE_FILE)..."
B64_KEYSTORE="$(base64 -w 0 "$KEYSTORE_FILE")"

echo "Uploading persistent Android signing secrets to GitHub repository: $REPO"
gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO" --body "$B64_KEYSTORE"
gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO" --body "zicode2026release"
gh secret set ANDROID_KEY_ALIAS --repo "$REPO" --body "zicode-key"
gh secret set ANDROID_KEY_PASSWORD --repo "$REPO" --body "zicode2026release"

echo "✓ All 4 Android persistent signing secrets successfully saved in GitHub Secrets for $REPO!"
