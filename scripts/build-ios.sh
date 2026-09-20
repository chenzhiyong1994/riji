#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
BUILD="$ROOT/ios/build"
mkdir -p "$ROOT/release"
xcodebuild -project ios/Riji.xcodeproj -scheme Riji -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath "$BUILD/device" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
APP="$BUILD/device/Build/Products/Release-iphoneos/Riji.app"
test -f "$APP/Riji"
VERSION=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist")
STAGING=$(mktemp -d "$BUILD/package.XXXXXX")
trap 'rm -rf "$STAGING"' EXIT
mkdir "$STAGING/Payload"
ditto "$APP" "$STAGING/Payload/Riji.app"
OUTPUT="$ROOT/release/Riji-$VERSION-ios-unsigned.ipa"
ditto -c -k --keepParent "$STAGING/Payload" "$OUTPUT"
python3 scripts/verify-ios-package.py "$OUTPUT"
(cd release && shasum -a 256 "$(basename "$OUTPUT")" > "$(basename "$OUTPUT").sha256")
echo "Unsigned IPA (requires personal signing before installation): $OUTPUT"
