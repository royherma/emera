#!/bin/bash
# Archives the committed HEAD (never the working tree) as an App Store build and uploads it.
# Usage: apps/mobile/scripts/ios-release.sh [build-number]   (default: 1 + highest build in ASC)
set -euo pipefail
repo="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
asc="${ASC_HELPER:-$HOME/Desktop/Development/ShowAndTell/bin/asc}"
app_id=6834311747
sha="$(git -C "$repo" rev-parse --short HEAD)"
out="$repo/.claude/artifacts/ios-release/$sha"
src="$HOME/Library/Caches/emera-release/$sha"

if [ -n "${1:-}" ]; then build="$1"; else
  last="$("$asc" GET "/v1/builds?filter%5Bapp%5D=$app_id&sort=-version&limit=1&fields%5Bbuilds%5D=version" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin)["data"]; print(d[0]["attributes"]["version"] if d else 0)')"
  build=$((last + 1))
fi
echo "Emera build $build from $sha"

export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"
export NODE_BINARY="$(command -v node)"
export EXPO_PUBLIC_API_URL=https://api.emera.social
export IOS_BUILD_NUMBER="$build"

rm -rf "$src" && mkdir -p "$src" "$out"
git -C "$repo" archive HEAD apps/mobile packages | tar -x -C "$src"
cd "$src/apps/mobile"
npm ci --prefer-offline --no-audit --no-fund
npx expo prebuild --platform ios --clean --no-install
(cd ios && env -u GEM_HOME -u GEM_PATH /opt/homebrew/bin/pod install)

xcodebuild -jobs 6 -workspace ios/Emera.xcworkspace -scheme Emera -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$out/Emera.xcarchive" \
  DEVELOPMENT_TEAM=BZJ35GS989 CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY='Apple Distribution' \
  PROVISIONING_PROFILE_SPECIFIER='Emera App Store' archive

cat > "$out/ExportOptions.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>export</string>
<key>teamID</key><string>BZJ35GS989</string>
<key>signingStyle</key><string>manual</string>
<key>signingCertificate</key><string>Apple Distribution</string>
<key>provisioningProfiles</key><dict><key>social.emera</key><string>Emera App Store</string></dict>
<key>manageAppVersionAndBuildNumber</key><false/>
<key>uploadSymbols</key><true/>
</dict></plist>
PLIST
xcodebuild -exportArchive -archivePath "$out/Emera.xcarchive" -exportPath "$out" -exportOptionsPlist "$out/ExportOptions.plist"

set -a; source "${ASC_ENV:-$HOME/Desktop/Development/ShowAndTell/.scratch-local/asc-api.env}"; set +a
key_dir="$(mktemp -d)"
trap 'rm -f "$key_dir"/AuthKey_*.p8; rmdir "$key_dir"' EXIT
ln -s "$ASC_KEY_PATH" "$key_dir/AuthKey_${ASC_KEY_ID}.p8"
export API_PRIVATE_KEYS_DIR="$key_dir"
xcrun altool --upload-app --file "$out/Emera.ipa" --type ios --apiKey "$ASC_KEY_ID" --apiIssuer "$ASC_ISSUER_ID" --output-format json
echo "Uploaded build $build ($sha). IPA: $out/Emera.ipa"
