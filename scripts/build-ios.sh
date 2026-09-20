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
OUTPUT="$ROOT/release/Riji-$VERSION-ios-unsigned.ipa"
# Write regular app files only; preserve their executable permissions without
# adding macOS resource forks or extra parent-directory records to the IPA.
python3 - "$APP" "$OUTPUT" <<'PY'
import pathlib, sys, zipfile
app = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(app.rglob('*')):
        if path.is_symlink():
            raise RuntimeError(f'Unexpected symlink in app: {path.relative_to(app)}')
        if path.is_file():
            archive.write(path, 'Payload/Riji.app/' + path.relative_to(app).as_posix())
PY
python3 scripts/verify-ios-package.py "$OUTPUT"
(cd release && shasum -a 256 "$(basename "$OUTPUT")" > "$(basename "$OUTPUT").sha256")
echo "Unsigned IPA (requires personal signing before installation): $OUTPUT"
