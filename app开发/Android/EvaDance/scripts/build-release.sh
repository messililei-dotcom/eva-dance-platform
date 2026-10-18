#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
: "${JAVA_HOME:?请设置 JDK 17 的 JAVA_HOME}"
sdk_dir="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_HOME="$sdk_dir"
if [ ! -f "$sdk_dir/licenses/android-sdk-license" ]; then
    echo 'Android SDK 许可尚未接受，请由持有人完成许可确认。' >&2
    exit 1
fi
if [ ! -f "$sdk_dir/platforms/android-36/android.jar" ]; then
    echo '请安装 platforms;android-36 和 build-tools;36.0.0。' >&2
    exit 1
fi
# Build on a native filesystem: macOS resource forks on exFAT break Android resource parsing.
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/eva-android-build.XXXXXX")
rsync -a --exclude='._*' --exclude=.gradle --exclude=build --exclude=local.properties --exclude=signing.local.properties "$project_dir/" "$work_dir/"
cd "$work_dir"
if [ -n "${EVA_GRADLE_BIN:-}" ]; then
    "$EVA_GRADLE_BIN" --console=plain :app:testDebugUnitTest :app:lintRelease :app:assembleDebug :app:assembleRelease :app:bundleRelease
else
    sh ./gradlew --console=plain :app:testDebugUnitTest :app:lintRelease :app:assembleDebug :app:assembleRelease :app:bundleRelease
fi
"$sdk_dir/build-tools/36.0.0/apksigner" verify --verbose --print-certs app/build/outputs/apk/release/app-release.apk
mkdir -p "$project_dir/app/build/outputs"
rsync -a app/build/outputs/ "$project_dir/app/build/outputs/"
printf 'Build and reports retained at: %s\n' "$work_dir"
