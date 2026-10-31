"""Generate a dependency-free Xcode project. No signing identities or private data."""
from pathlib import Path
import hashlib, json, plistlib, os
import runpy
root = Path(__file__).resolve().parents[1]
objects = {}
def oid(name): return hashlib.sha256(name.encode()).hexdigest()[:24].upper()
def put(object_name, isa, **fields):
    key = oid(object_name); objects[key] = {'isa': isa, **fields}; return key
sources = []
refs = []
for path in sorted((root/'Sources/EvaDanceApp').glob('*.swift')):
    if path.name.startswith('._'): continue
    ref = put(path.name, 'PBXFileReference', lastKnownFileType='sourcecode.swift', path=str(path.relative_to(root)), sourceTree='<group>')
    refs.append(ref); sources.append(put('build-'+path.name, 'PBXBuildFile', fileRef=ref))
privacy = put('PrivacyInfo', 'PBXFileReference', lastKnownFileType='text.xml', path='Resources/PrivacyInfo.xcprivacy', sourceTree='<group>')
privacy_build = put('privacy-build', 'PBXBuildFile', fileRef=privacy)
assets = put('assets', 'PBXFileReference', lastKnownFileType='folder.assetcatalog', path='Resources/Assets.xcassets', sourceTree='<group>')
assets_build = put('assets-build', 'PBXBuildFile', fileRef=assets)
product = put('product', 'PBXFileReference', explicitFileType='wrapper.application', path='EvaDance.app', sourceTree='BUILT_PRODUCTS_DIR')
products = put('products', 'PBXGroup', name='Products', children=[product], sourceTree='<group>')
vendor_refs=[]; vendor_builds=[]; optional_refs=[]; optional_resources=[]
vod_loader = root.parents[1]/'共享资料/scripts/prepare_vod_config.py'
vod_assets = runpy.run_path(str(vod_loader))['load_assets']('ios') if vod_loader.is_file() else None
vod_info = Path.home()/'Library/Caches/SWOD/vod-ios/Info.local.plist'
# The client SDK scheme stays outside source and is bundled only in configured builds.
local_config=Path.home()/'.config/eva-app/ios-number-auth.json'
include_number_auth = os.environ.get('EVA_INCLUDE_NUMBER_AUTH', '1') == '1' and local_config.is_file()
if include_number_auth:
    for name in ['ATAuthSDK','YTXOperators','YTXMonitor']:
        r=put(name,'PBXFileReference',lastKnownFileType='wrapper.xcframework',path=f'Vendor/NumberAuth/{name}.xcframework',sourceTree='<group>')
        vendor_refs.append(r); vendor_builds.append(put(name+'-link','PBXBuildFile',fileRef=r))
    private_resource=Path.home()/'Library/Caches/SWOD/ios-number-auth/NumberAuth.local.plist'
    private_resource.parent.mkdir(parents=True,exist_ok=True)
    private_resource.write_bytes(plistlib.dumps(json.loads(local_config.read_text())))
    private_resource.chmod(0o600)
    private_ref=put('numberauth-config','PBXFileReference',lastKnownFileType='text.plist.xml',path=str(private_resource),sourceTree='<absolute>')
    sdk_bundle_ref=put('authsdk-bundle','PBXFileReference',lastKnownFileType='wrapper.plug-in',path='Vendor/NumberAuth/ATAuthSDK.bundle',sourceTree='<group>')
    optional_refs=[private_ref,sdk_bundle_ref]
    optional_resources=[put('numberauth-config-build','PBXBuildFile',fileRef=private_ref),put('authsdk-bundle-build','PBXBuildFile',fileRef=sdk_bundle_ref)]
if vod_assets:
    for label, path in [('vod-license-cert', vod_assets['certificate']), ('vod-download-key', vod_assets['downloadKey'])]:
        ref=put(label,'PBXFileReference',lastKnownFileType='file',path=path,sourceTree='<absolute>')
        optional_refs.append(ref); optional_resources.append(put(label+'-build','PBXBuildFile',fileRef=ref))
group = put('root', 'PBXGroup', children=refs+vendor_refs+[privacy, assets]+optional_refs+[products], sourceTree='<group>')
package = put('local-package', 'XCLocalSwiftPackageReference', relativePath='.')
dependency = put('core-product', 'XCSwiftPackageProductDependency', package=package, productName='EvaCore')
framework = put('core-framework', 'PBXBuildFile', productRef=dependency)
phases = [put('sources', 'PBXSourcesBuildPhase', buildActionMask=2147483647, files=sources, runOnlyForDeploymentPostprocessing=0),
          put('frameworks', 'PBXFrameworksBuildPhase', buildActionMask=2147483647, files=[framework]+vendor_builds, runOnlyForDeploymentPostprocessing=0),
          put('resources', 'PBXResourcesBuildPhase', buildActionMask=2147483647, files=[privacy_build,assets_build]+optional_resources, runOnlyForDeploymentPostprocessing=0)]
# The vendor distribution contains arm64 device and x86_64 simulator slices.
# Apple Silicon simulator builds keep the system player and never link a device-only slice.
vod_root = root/'Vendor/AliyunPlayer'
vod_frameworks = ['AliyunPlayer','AliyunMediaDownloader','alivcffmpeg']
if all((vod_root/(name+'.framework')).is_dir() for name in vod_frameworks):
    embed = '''if [ "$PLATFORM_NAME" != "iphoneos" ]; then exit 0; fi
mkdir -p "$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH"
for framework in AliyunPlayer AliyunMediaDownloader alivcffmpeg; do
  source="$SRCROOT/Vendor/AliyunPlayer/$framework.framework"
  target="$TARGET_BUILD_DIR/$FRAMEWORKS_FOLDER_PATH/$framework.framework"
  /usr/bin/ditto "$source" "$target"
  /usr/bin/lipo "$target/$framework" -thin arm64 -output "$target/$framework.arm64"
  /bin/mv "$target/$framework.arm64" "$target/$framework"
  if [ "$CODE_SIGNING_ALLOWED" = "YES" ] && [ -n "$EXPANDED_CODE_SIGN_IDENTITY" ]; then
    /usr/bin/codesign --force --sign "$EXPANDED_CODE_SIGN_IDENTITY" "$target"
  fi
done
'''
    phases.append(put('embed-vod-frameworks','PBXShellScriptBuildPhase',buildActionMask=2147483647,files=[],inputPaths=[],outputPaths=[],runOnlyForDeploymentPostprocessing=0,shellPath='/bin/sh',shellScript=embed))
configs=[]; project_configs=[]
for mode in ['Debug','Release']:
    configs.append(put('target-'+mode, 'XCBuildConfiguration', name=mode, buildSettings={
        'PRODUCT_BUNDLE_IDENTIFIER':'cn.com.swod.app', 'PRODUCT_NAME':'$(TARGET_NAME)',
        'MARKETING_VERSION':'1.0.0','CURRENT_PROJECT_VERSION':'8', 'IPHONEOS_DEPLOYMENT_TARGET':'16.0',
        'TARGETED_DEVICE_FAMILY':'1,2', 'SDKROOT':'iphoneos','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator',
        'SWIFT_VERSION':'5.0','CODE_SIGN_STYLE':'Automatic','INFOPLIST_FILE':str(vod_info) if vod_assets else 'Resources/Info.plist',
        'GENERATE_INFOPLIST_FILE':'NO', 'SWIFT_OPTIMIZATION_LEVEL':'-Onone' if mode=='Debug' else '-O',
        'ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon',
        'SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG' if mode=='Debug' else '',
        'ONLY_ACTIVE_ARCH':'YES' if mode=='Debug' else 'NO',
        'FRAMEWORK_SEARCH_PATHS[sdk=iphoneos*]':['$(inherited)', '$(SRCROOT)/Vendor/AliyunPlayer'],
        'OTHER_LDFLAGS[sdk=iphoneos*]':['$(inherited)', '-framework','AliyunPlayer','-framework','AliyunMediaDownloader','-framework','alivcffmpeg'],
        'OTHER_LDFLAGS':['$(inherited)', '-ObjC', '-lc++', '-lz', '-lsqlite3'],
        'LD_RUNPATH_SEARCH_PATHS':['$(inherited)', '@executable_path/Frameworks'],
        'DEBUG_INFORMATION_FORMAT':'dwarf' if mode=='Debug' else 'dwarf-with-dsym'}))
    project_configs.append(put('project-'+mode,'XCBuildConfiguration',name=mode,buildSettings={'CLANG_ENABLE_MODULES':'YES'}))
target_configs=put('target-config-list','XCConfigurationList',buildConfigurations=configs,defaultConfigurationIsVisible=0,defaultConfigurationName='Release')
project_config_list=put('project-config-list','XCConfigurationList',buildConfigurations=project_configs,defaultConfigurationIsVisible=0,defaultConfigurationName='Release')
target=put('app-target','PBXNativeTarget',name='EvaDance',productName='EvaDance',productType='com.apple.product-type.application',productReference=product,buildConfigurationList=target_configs,buildPhases=phases,buildRules=[],dependencies=[],packageProductDependencies=[dependency])
project=put('project','PBXProject',attributes={'LastUpgradeCheck':'2600','BuildIndependentTargetsInParallel':'YES'},buildConfigurationList=project_config_list,compatibilityVersion='Xcode 14.0',developmentRegion='zh-Hans',knownRegions=['zh-Hans','en','Base'],mainGroup=group,productRefGroup=products,projectDirPath='',projectRoot='',targets=[target],packageReferences=[package])
def serialize(value):
    if isinstance(value,dict): return '{\n'+'\n'.join(json.dumps(k)+' = '+serialize(v)+';' for k,v in value.items())+'\n}'
    if isinstance(value,list): return '( '+', '.join(serialize(v) for v in value)+' )'
    if isinstance(value,int): return str(value)
    return json.dumps(value,ensure_ascii=False)
pdir=root/'EvaDance.xcodeproj'; pdir.mkdir(exist_ok=True)
(pdir/'project.pbxproj').write_text('// !$*UTF8*$!\n'+serialize({'archiveVersion':1,'classes':{},'objectVersion':56,'objects':objects,'rootObject':project})+'\n')
schemes=pdir/'xcshareddata/xcschemes';schemes.mkdir(parents=True,exist_ok=True)
ref=f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="EvaDance.app" BlueprintName="EvaDance" ReferencedContainer="container:EvaDance.xcodeproj"/>'
(schemes/'EvaDance.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2600" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry></BuildActionEntries></BuildAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>\n''')
# Explicit local-only run scheme; the normal and Release schemes keep the official API.
fixture_scheme = (schemes/'EvaDance.xcscheme').read_text().replace('</LaunchAction>', '<EnvironmentVariables><EnvironmentVariable key="EVA_API_BASE" value="http://127.0.0.1:18765/api/app/v1" isEnabled="YES"/></EnvironmentVariables></LaunchAction>')
(schemes/'EvaDance-Fixtures.xcscheme').write_text(fixture_scheme)
info={'CFBundleDisplayName':'SWOD','CFBundleName':'$(PRODUCT_NAME)','CFBundleIdentifier':'$(PRODUCT_BUNDLE_IDENTIFIER)','CFBundleExecutable':'$(EXECUTABLE_NAME)','CFBundlePackageType':'APPL','CFBundleShortVersionString':'$(MARKETING_VERSION)','CFBundleVersion':'$(CURRENT_PROJECT_VERSION)','LSRequiresIPhoneOS':True,'UILaunchScreen':{},'UIApplicationSceneManifest':{'UIApplicationSupportsMultipleScenes':False},'UISupportedInterfaceOrientations':['UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],'UISupportedInterfaceOrientations~ipad':['UIInterfaceOrientationPortrait','UIInterfaceOrientationPortraitUpsideDown','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight'],'ITSAppUsesNonExemptEncryption':False}
# User supplied the issued App filing number on 2026-10-23. Keep it in the
# generated bundle so the About screen and release evidence share one value.
info['SWODAppFilingNumber'] = '湘ICP备2026005683号-5A'
# Public registration only. No SDK, callback handler or login availability is
# implied by these fields. Never copy the server's mobile AppSecret here.
wechat = json.loads((root/'Resources/wechat-mobile.public.json').read_text())
if wechat['applicationType'] != 'mobile' or wechat['iosBundleId'] != 'cn.com.swod.app' or wechat['loginEnabled'] is not False:
    raise SystemExit('Invalid WeChat registration or unapproved login enablement')
info['SWODWeChatAppID'] = wechat['appId']
info['SWODWeChatUniversalLink'] = wechat['universalLink']
info['SWODWeChatLoginEnabled'] = False
(root/'Resources/Info.plist').write_bytes(plistlib.dumps(info,sort_keys=False))
if vod_assets:
    private_info=info.copy();private_info['AlivcLicenseFile']='AliVideoCert.crt';private_info['AlivcLicenseKey']=vod_assets['licenseKey']
    vod_info.parent.mkdir(parents=True,exist_ok=True);vod_info.write_bytes(plistlib.dumps(private_info,sort_keys=False));vod_info.chmod(0o600)
# Static SDK frameworks do not copy their privacy manifests into the app.
# Merge the shipped device manifests; do not silently omit required API reasons.
privacy={'NSPrivacyTracking':False,'NSPrivacyTrackingDomains':[],'NSPrivacyCollectedDataTypes':[{'NSPrivacyCollectedDataType':kind, 'NSPrivacyCollectedDataTypeLinked':True, 'NSPrivacyCollectedDataTypeTracking':False, 'NSPrivacyCollectedDataTypePurposes':['NSPrivacyCollectedDataTypePurposeAppFunctionality']} for kind in ['NSPrivacyCollectedDataTypePhoneNumber','NSPrivacyCollectedDataTypeUserID','NSPrivacyCollectedDataTypeProductInteraction','NSPrivacyCollectedDataTypeName','NSPrivacyCollectedDataTypePhysicalAddress','NSPrivacyCollectedDataTypeOtherUserContent','NSPrivacyCollectedDataTypePurchaseHistory','NSPrivacyCollectedDataTypeAudioData','NSPrivacyCollectedDataTypeOtherDataTypes','NSPrivacyCollectedDataTypeFitness']], 'NSPrivacyAccessedAPITypes':[]}
for row in privacy['NSPrivacyCollectedDataTypes']:
    kind=row['NSPrivacyCollectedDataType']
    if kind in ['NSPrivacyCollectedDataTypeName','NSPrivacyCollectedDataTypePhoneNumber','NSPrivacyCollectedDataTypeFitness','NSPrivacyCollectedDataTypeUserID','NSPrivacyCollectedDataTypePurchaseHistory','NSPrivacyCollectedDataTypeProductInteraction']:
        row['NSPrivacyCollectedDataTypePurposes'].append('NSPrivacyCollectedDataTypePurposeAnalytics')
    if kind in ['NSPrivacyCollectedDataTypeUserID','NSPrivacyCollectedDataTypePurchaseHistory','NSPrivacyCollectedDataTypeProductInteraction']:
        row['NSPrivacyCollectedDataTypePurposes'].append('NSPrivacyCollectedDataTypePurposeProductPersonalization')
for name in (['ATAuthSDK', 'YTXOperators', 'YTXMonitor'] if include_number_auth else []):
    manifest = root/f'Vendor/NumberAuth/{name}.xcframework/ios-arm64/{name}.framework/PrivacyInfo.xcprivacy'
    sdk = plistlib.loads(manifest.read_bytes())
    privacy['NSPrivacyTracking'] |= sdk.get('NSPrivacyTracking', False)
    privacy['NSPrivacyTrackingDomains'] = sorted(set(privacy['NSPrivacyTrackingDomains'] + sdk.get('NSPrivacyTrackingDomains', [])))
    for declaration in sdk.get('NSPrivacyCollectedDataTypes', []):
        kind = declaration['NSPrivacyCollectedDataType']
        existing = next((row for row in privacy['NSPrivacyCollectedDataTypes'] if row['NSPrivacyCollectedDataType'] == kind), None)
        if existing is None:
            privacy['NSPrivacyCollectedDataTypes'].append(declaration.copy())
        else:
            for flag in ['NSPrivacyCollectedDataTypeLinked', 'NSPrivacyCollectedDataTypeTracking']:
                existing[flag] |= declaration.get(flag, False)
            existing['NSPrivacyCollectedDataTypePurposes'] = sorted(set(existing['NSPrivacyCollectedDataTypePurposes'] + declaration.get('NSPrivacyCollectedDataTypePurposes', [])))
    for declaration in sdk.get('NSPrivacyAccessedAPITypes', []):
        kind = declaration['NSPrivacyAccessedAPIType']
        existing = next((row for row in privacy['NSPrivacyAccessedAPITypes'] if row['NSPrivacyAccessedAPIType'] == kind), None)
        if existing is None:
            privacy['NSPrivacyAccessedAPITypes'].append(declaration.copy())
        else:
            existing['NSPrivacyAccessedAPITypeReasons'] = sorted(set(existing['NSPrivacyAccessedAPITypeReasons'] + declaration.get('NSPrivacyAccessedAPITypeReasons', [])))
# Local elapsed-time lease validation and pre-download capacity checks. These
# device signals remain local; neither is an analytics or fingerprinting input.
for kind, reason in [('NSPrivacyAccessedAPICategorySystemBootTime','35F9.1'), ('NSPrivacyAccessedAPICategoryDiskSpace','E174.1')]:
    row = next((row for row in privacy['NSPrivacyAccessedAPITypes'] if row['NSPrivacyAccessedAPIType'] == kind), None)
    if row is None: privacy['NSPrivacyAccessedAPITypes'].append({'NSPrivacyAccessedAPIType':kind,'NSPrivacyAccessedAPITypeReasons':[reason]})
    elif reason not in row['NSPrivacyAccessedAPITypeReasons']: row['NSPrivacyAccessedAPITypeReasons'].append(reason)
(root/'Resources/PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(privacy,sort_keys=False))
print('Generated EvaDance.xcodeproj (unsigned; privacy matches included components; store answers still require review)')
