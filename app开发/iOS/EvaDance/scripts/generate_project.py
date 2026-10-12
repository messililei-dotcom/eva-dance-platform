"""Generate a dependency-free Xcode project. No signing identities or private data."""
from pathlib import Path
import hashlib, json, plistlib
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
vendor_refs=[]; vendor_builds=[]
for name in ['ATAuthSDK','YTXOperators','YTXMonitor']:
    r=put(name,'PBXFileReference',lastKnownFileType='wrapper.xcframework',path=f'Vendor/NumberAuth/{name}.xcframework',sourceTree='<group>')
    vendor_refs.append(r); vendor_builds.append(put(name+'-link','PBXBuildFile',fileRef=r))
local_config=Path.home()/'.config/eva-app/ios-number-auth.json'
private_resource=root/'Resources/NumberAuth.local.plist'
private_resource.write_bytes(plistlib.dumps(json.loads(local_config.read_text()) if local_config.exists() else {}))
private_ref=put('numberauth-config','PBXFileReference',lastKnownFileType='text.plist.xml',path='Resources/NumberAuth.local.plist',sourceTree='<group>')
sdk_bundle_ref=put('authsdk-bundle','PBXFileReference',lastKnownFileType='wrapper.plug-in',path='Vendor/NumberAuth/ATAuthSDK.bundle',sourceTree='<group>')
sdk_bundle_build=put('authsdk-bundle-build','PBXBuildFile',fileRef=sdk_bundle_ref)
private_build=put('numberauth-config-build','PBXBuildFile',fileRef=private_ref)
group = put('root', 'PBXGroup', children=refs+vendor_refs+[privacy, assets, private_ref, sdk_bundle_ref, products], sourceTree='<group>')
package = put('local-package', 'XCLocalSwiftPackageReference', relativePath='.')
dependency = put('core-product', 'XCSwiftPackageProductDependency', package=package, productName='EvaCore')
framework = put('core-framework', 'PBXBuildFile', productRef=dependency)
phases = [put('sources', 'PBXSourcesBuildPhase', buildActionMask=2147483647, files=sources, runOnlyForDeploymentPostprocessing=0),
          put('frameworks', 'PBXFrameworksBuildPhase', buildActionMask=2147483647, files=[framework]+vendor_builds, runOnlyForDeploymentPostprocessing=0),
          put('resources', 'PBXResourcesBuildPhase', buildActionMask=2147483647, files=[privacy_build,assets_build,private_build,sdk_bundle_build], runOnlyForDeploymentPostprocessing=0)]
configs=[]; project_configs=[]
for mode in ['Debug','Release']:
    configs.append(put('target-'+mode, 'XCBuildConfiguration', name=mode, buildSettings={
        'PRODUCT_BUNDLE_IDENTIFIER':'cn.com.swod.app', 'PRODUCT_NAME':'$(TARGET_NAME)',
        'MARKETING_VERSION':'1.0.0','CURRENT_PROJECT_VERSION':'3', 'IPHONEOS_DEPLOYMENT_TARGET':'16.0',
        'TARGETED_DEVICE_FAMILY':'1,2', 'SDKROOT':'iphoneos','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator',
        'SWIFT_VERSION':'5.0','CODE_SIGN_STYLE':'Automatic','INFOPLIST_FILE':'Resources/Info.plist',
        'GENERATE_INFOPLIST_FILE':'NO', 'SWIFT_OPTIMIZATION_LEVEL':'-Onone' if mode=='Debug' else '-O',
        'ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon',
        'SWIFT_ACTIVE_COMPILATION_CONDITIONS':'DEBUG' if mode=='Debug' else '',
        'ONLY_ACTIVE_ARCH':'YES' if mode=='Debug' else 'NO',
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
(root/'Resources/Info.plist').write_bytes(plistlib.dumps(info,sort_keys=False))
# Draft for the current first-party code only. Must reconcile actual SDKs and App Store privacy answers before release.
privacy={'NSPrivacyTracking':False,'NSPrivacyTrackingDomains':[],'NSPrivacyCollectedDataTypes':[{'NSPrivacyCollectedDataType':kind, 'NSPrivacyCollectedDataTypeLinked':True, 'NSPrivacyCollectedDataTypeTracking':False, 'NSPrivacyCollectedDataTypePurposes':['NSPrivacyCollectedDataTypePurposeAppFunctionality']} for kind in ['NSPrivacyCollectedDataTypePhoneNumber','NSPrivacyCollectedDataTypeUserID','NSPrivacyCollectedDataTypeProductInteraction','NSPrivacyCollectedDataTypeName','NSPrivacyCollectedDataTypePhysicalAddress','NSPrivacyCollectedDataTypeOtherUserContent','NSPrivacyCollectedDataTypePurchaseHistory']], 'NSPrivacyAccessedAPITypes':[]}
(root/'Resources/PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps(privacy,sort_keys=False))
print('Generated EvaDance.xcodeproj (unsigned; privacy manifest is a draft)')
