#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p qa
DEVICE=$(xcrun simctl list devices available -j | python3 -c 'import json,sys; d=json.load(sys.stdin); print(next(x["udid"] for k,v in d["devices"].items() if "iOS" in k for x in v if "iPhone" in x["name"]))')
trap 'xcrun simctl io "$DEVICE" screenshot qa/ios-simulator.png || true' EXIT
xcodebuild -project ios/Riji.xcodeproj -scheme Riji -configuration Debug \
  -destination "platform=iOS Simulator,id=$DEVICE" -derivedDataPath ios/build/simulator \
  -resultBundlePath "qa/ios-tests-$(date +%s).xcresult" \
  CODE_SIGNING_ALLOWED=NO -parallel-testing-enabled NO test
# XCTest may run on a cloned device and shut it down afterward. Install the
# tested build on the selected simulator explicitly for a clean launch capture.
xcrun simctl bootstatus "$DEVICE" -b
xcrun simctl install "$DEVICE" ios/build/simulator/Build/Products/Debug-iphonesimulator/Riji.app
xcrun simctl launch "$DEVICE" local.jilian.app
sleep 5
xcrun simctl io "$DEVICE" screenshot qa/ios-simulator.png
