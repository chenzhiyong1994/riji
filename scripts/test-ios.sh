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
xcrun simctl launch "$DEVICE" local.jilian.app
sleep 3
xcrun simctl io "$DEVICE" screenshot qa/ios-simulator.png
