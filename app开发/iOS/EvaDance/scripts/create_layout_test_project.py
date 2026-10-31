"""Create an isolated UI-test project from the current project, without changing signing/settings."""
import hashlib
import json
import argparse
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("output", type=Path)
parser.add_argument("--testable", action="store_true", help="Enable app-module imports for hosted audio unit tests only")
args = parser.parse_args()
out = args.output.resolve()
project_dir = out / "EvaDance.xcodeproj"
project_dir.mkdir(parents=True, exist_ok=True)
project = json.loads(subprocess.check_output([
    "plutil", "-convert", "json", "-o", "-", str(root / "EvaDance.xcodeproj/project.pbxproj")
]))
objects = project["objects"]
for obj in objects.values():
    if obj["isa"] == "PBXFileReference" and obj.get("sourceTree") == "<group>" and obj.get("path"):
        obj["path"] = str(root / obj["path"])
        obj["sourceTree"] = "<absolute>"
    if obj["isa"] == "XCLocalSwiftPackageReference":
        obj["relativePath"] = str(root)
    if obj["isa"] == "XCBuildConfiguration":
        settings = obj.get("buildSettings", {})
        if args.testable:
            settings["ENABLE_TESTABILITY"] = "YES"
        for key in ["INFOPLIST_FILE", "CODE_SIGN_ENTITLEMENTS"]:
            if key in settings and not Path(settings[key]).is_absolute():
                settings[key] = str(root / settings[key])

def put(object_name, isa, **fields):
    key = hashlib.sha256(("layout-qa-" + object_name).encode()).hexdigest()[:24].upper()
    objects[key] = {"isa": isa, **fields}
    return key

app = next(key for key, value in objects.items() if value["isa"] == "PBXNativeTarget" and value["name"] == "EvaDance")
test_ref = put("source", "PBXFileReference", lastKnownFileType="sourcecode.swift", path=str(root / "Tests/EvaLayoutUITests/RootLayoutTests.swift"), sourceTree="<absolute>")
test_build = put("source-build", "PBXBuildFile", fileRef=test_ref)
product = put("product", "PBXFileReference", explicitFileType="wrapper.cfbundle", path="EvaLayoutUITests.xctest", sourceTree="BUILT_PRODUCTS_DIR")
sources = put("sources", "PBXSourcesBuildPhase", buildActionMask=2147483647, files=[test_build], runOnlyForDeploymentPostprocessing=0)
configs = [put(mode, "XCBuildConfiguration", name=mode, buildSettings={
    "PRODUCT_BUNDLE_IDENTIFIER": "cn.com.swod.layoutuitests", "PRODUCT_NAME": "$(TARGET_NAME)",
    "SWIFT_VERSION": "5.0", "IPHONEOS_DEPLOYMENT_TARGET": "16.0", "SDKROOT": "iphoneos",
    "GENERATE_INFOPLIST_FILE": "YES", "TEST_TARGET_NAME": "EvaDance", "TARGETED_DEVICE_FAMILY": "1,2",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG" if mode == "Debug" else "",
    "CODE_SIGNING_ALLOWED": "NO"
}) for mode in ["Debug", "Release"]]
config_list = put("config-list", "XCConfigurationList", buildConfigurations=configs, defaultConfigurationIsVisible=0, defaultConfigurationName="Debug")
proxy = put("proxy", "PBXContainerItemProxy", containerPortal=project["rootObject"], proxyType=1, remoteGlobalIDString=app, remoteInfo="EvaDance")
dep = put("dependency", "PBXTargetDependency", target=app, targetProxy=proxy)
test = put("target", "PBXNativeTarget", name="EvaLayoutUITests", productName="EvaLayoutUITests", productType="com.apple.product-type.bundle.ui-testing", productReference=product, buildConfigurationList=config_list, buildPhases=[sources], buildRules=[], dependencies=[dep])
objects[project["rootObject"]]["targets"].append(test)
objects[objects[project["rootObject"]]["mainGroup"]]["children"].append(test_ref)
objects[objects[project["rootObject"]]["productRefGroup"]]["children"].append(product)
objects[project["rootObject"]].setdefault("attributes", {}).setdefault("TargetAttributes", {})[test] = {"TestTargetID": app}

audio_refs = []
audio_builds = []
for source in sorted((root / "Tests/EvaPlaybackTests").glob("*.swift")):
    if source.name.startswith("."):
        continue
    audio_ref = put("unit-" + source.name, "PBXFileReference", lastKnownFileType="sourcecode.swift", path=str(source), sourceTree="<absolute>")
    audio_refs.append(audio_ref)
    audio_builds.append(put("unit-build-" + source.name, "PBXBuildFile", fileRef=audio_ref))
audio_product = put("audio-product", "PBXFileReference", explicitFileType="wrapper.cfbundle", path="EvaPlaybackTests.xctest", sourceTree="BUILT_PRODUCTS_DIR")
audio_sources = put("audio-sources", "PBXSourcesBuildPhase", buildActionMask=2147483647, files=audio_builds, runOnlyForDeploymentPostprocessing=0)
audio_configs = [put("audio-" + mode, "XCBuildConfiguration", name=mode, buildSettings={
    "PRODUCT_BUNDLE_IDENTIFIER": "cn.com.swod.playbacktests", "PRODUCT_NAME": "$(TARGET_NAME)",
    "SWIFT_VERSION": "5.0", "IPHONEOS_DEPLOYMENT_TARGET": "16.0", "SDKROOT": "iphoneos",
    "GENERATE_INFOPLIST_FILE": "YES", "TARGETED_DEVICE_FAMILY": "1,2", "CODE_SIGNING_ALLOWED": "NO",
    "ONLY_ACTIVE_ARCH": "YES",
    "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG" if mode == "Debug" else "",
    "TEST_HOST": "$(BUILT_PRODUCTS_DIR)/EvaDance.app/EvaDance", "BUNDLE_LOADER": "$(TEST_HOST)"
}) for mode in ["Debug", "Release"]]
audio_config_list = put("audio-config-list", "XCConfigurationList", buildConfigurations=audio_configs, defaultConfigurationIsVisible=0, defaultConfigurationName="Debug")
audio_test = put("audio-target", "PBXNativeTarget", name="EvaPlaybackTests", productName="EvaPlaybackTests", productType="com.apple.product-type.bundle.unit-test", productReference=audio_product, buildConfigurationList=audio_config_list, buildPhases=[audio_sources], buildRules=[], dependencies=[dep])
objects[project["rootObject"]]["targets"].append(audio_test)
objects[objects[project["rootObject"]]["mainGroup"]]["children"].extend(audio_refs)
objects[objects[project["rootObject"]]["productRefGroup"]]["children"].append(audio_product)

def serialize(value):
    if isinstance(value, dict):
        return "{\n" + "\n".join(json.dumps(k) + " = " + serialize(v) + ";" for k, v in value.items()) + "\n}"
    if isinstance(value, list):
        return "( " + ", ".join(serialize(v) for v in value) + " )"
    if isinstance(value, int):
        return str(value)
    return json.dumps(value, ensure_ascii=False)

(project_dir / "project.pbxproj").write_text("// !$*UTF8*$!\n" + serialize(project))
schemes = project_dir / "xcshareddata/xcschemes"
schemes.mkdir(parents=True, exist_ok=True)
def ref(key, name, build):
    return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{key}" BuildableName="{build}" BlueprintName="{name}" ReferencedContainer="container:EvaDance.xcodeproj"/>'
app_ref = ref(app, "EvaDance", "EvaDance.app")
test_product = ref(test, "EvaLayoutUITests", "EvaLayoutUITests.xctest")
audio_test_product = ref(audio_test, "EvaPlaybackTests", "EvaPlaybackTests.xctest")
(schemes / "EvaLayoutQA.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme version="1.3">
<BuildAction buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">{app_ref}</BuildActionEntry><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">{test_product}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{test_product}</TestableReference></Testables><MacroExpansion>{app_ref}</MacroExpansion></TestAction>
<LaunchAction buildConfiguration="Debug"><BuildableProductRunnable runnableDebuggingMode="0">{app_ref}</BuildableProductRunnable></LaunchAction>
</Scheme>''')
(schemes / "EvaPlaybackQA.xcscheme").write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme version="1.3">
<BuildAction buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">{app_ref}</BuildActionEntry><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">{audio_test_product}</BuildActionEntry></BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB"><Testables><TestableReference skipped="NO">{audio_test_product}</TestableReference></Testables><MacroExpansion>{app_ref}</MacroExpansion></TestAction>
</Scheme>''')
print(project_dir)
