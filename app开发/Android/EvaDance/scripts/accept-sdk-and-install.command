#!/bin/sh
set -eu
JAVA_HOME="${JAVA_HOME:-$HOME/Library/Developer/EvaToolchains/jdk-17.0.20.1+1/Contents/Home}"
export JAVA_HOME
sdk_dir="$HOME/Library/Android/sdk"
manager="$sdk_dir/cmdline-tools/19.0/bin/sdkmanager"
# Interactive: the account holder reads the SDK license and answers each prompt.
"$manager" --sdk_root="$sdk_dir" --licenses
if [ ! -f "$sdk_dir/licenses/android-sdk-license" ]; then
    echo '未接受许可，安装未继续。' >&2
    exit 1
fi
"$manager" --sdk_root="$sdk_dir" 'platforms;android-36' 'build-tools;36.0.0' 'platform-tools'
