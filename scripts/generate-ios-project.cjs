// Dependency-free, deterministic Xcode project. Run after adding native files.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const root = path.join(__dirname, "../ios");
const id = (name) =>
  crypto
    .createHash("sha256")
    .update(name)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
const objects = [];
const add = (name, body) => {
  objects.push(`${id(name)} = { ${body} };`);
  return id(name);
};
const list = (values) => values.length ? `(${values.join(", ")},)` : "()";
const quote = (value) => JSON.stringify(value);
const ref = (name, file, type, sourceTree = "<group>") =>
  add(
    name,
    `isa = PBXFileReference; lastKnownFileType = ${quote(type)}; path = ${quote(file)}; sourceTree = ${quote(sourceTree)};`,
  );
const build = (name, file) =>
  add(name, `isa = PBXBuildFile; fileRef = ${file};`);
const sourceNames = [
  "AppDelegate.swift",
  "StateStore.swift",
  "TrainingViewController.swift",
];
const sourceRefs = sourceNames.map((n) => ref(n, n, "sourcecode.swift"));
const resourceNames = [
  ["native-bridge.js", "sourcecode.javascript"],
  ["PrivacyInfo.xcprivacy", "text.xml"],
  ["Assets.xcassets", "folder.assetcatalog"],
];
const resourceRefs = resourceNames.map(([n, t]) => ref(n, n, t));
const info = ref("Info.plist", "Info.plist", "text.plist.xml");
const assets = ref(
  "SharedAssets",
  "../app/src/main/assets",
  "folder",
  "SOURCE_ROOT",
);
const app = ref(
  "AppProduct",
  "Riji.app",
  "wrapper.application",
  "BUILT_PRODUCTS_DIR",
);
const test = ref(
  "TestProduct",
  "RijiTests.xctest",
  "wrapper.cfbundle",
  "BUILT_PRODUCTS_DIR",
);
const testSource = ref("TestSource", "RijiTests.swift", "sourcecode.swift");
const group = (name, children, extra = "") =>
  add(
    name,
    `isa = PBXGroup; children = ${list(children)}; sourceTree = "<group>"; ${extra}`,
  );
const nativeGroup = group(
  "NativeGroup",
  [...sourceRefs, ...resourceRefs, info],
  "path = Riji;",
);
const testGroup = group("TestGroup", [testSource], "path = RijiTests;");
const products = group("Products", [app, test], "name = Products;");
const main = group("Main", [nativeGroup, testGroup, assets, products]);
const phase = (name, type, files) =>
  add(
    name,
    `isa = ${type}; buildActionMask = 2147483647; files = ${list(files)}; runOnlyForDeploymentPostprocessing = 0;`,
  );
const sources = phase(
  "Sources",
  "PBXSourcesBuildPhase",
  sourceRefs.map((r, i) => build("Compile" + i, r)),
);
const resources = phase(
  "Resources",
  "PBXResourcesBuildPhase",
  [...resourceRefs, assets].map((r, i) => build("Resource" + i, r)),
);
const frameworks = phase("Frameworks", "PBXFrameworksBuildPhase", []);
const testSources = phase("TestSources", "PBXSourcesBuildPhase", [
  build("TestCompile", testSource),
]);
const configList = (name, settings) => {
  const configs = ["Debug", "Release"].map((mode) =>
    add(
      name + mode,
      `isa = XCBuildConfiguration; name = ${mode}; buildSettings = { ${settings(mode)} };`,
    ),
  );
  return add(
    name + "Configs",
    `isa = XCConfigurationList; buildConfigurations = ${list(configs)}; defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;`,
  );
};
const shared = configList(
  "Project",
  (mode) =>
    `CLANG_ENABLE_MODULES = YES; SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 16.0; SWIFT_VERSION = 5.0; TARGETED_DEVICE_FAMILY = "1,2"; GCC_C_LANGUAGE_STANDARD = gnu17; DEBUG_INFORMATION_FORMAT = ${mode === "Debug" ? "dwarf" : '"dwarf-with-dsym"'}; SWIFT_OPTIMIZATION_LEVEL = ${mode === "Debug" ? '"-Onone"' : '"-O"'}; ${mode === "Debug" ? "ENABLE_TESTABILITY = YES; SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG; ONLY_ACTIVE_ARCH = YES;" : ""}`,
);
const appConfig = configList(
  "App",
  () =>
    'PRODUCT_BUNDLE_IDENTIFIER = local.jilian.app; PRODUCT_NAME = "$(TARGET_NAME)"; INFOPLIST_FILE = Riji/Info.plist; MARKETING_VERSION = 1.1.3; CURRENT_PROJECT_VERSION = 1; ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon; CODE_SIGN_STYLE = Automatic; LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks";',
);
const testConfig = configList(
  "Test",
  () =>
    'PRODUCT_BUNDLE_IDENTIFIER = local.jilian.app.tests; PRODUCT_NAME = "$(TARGET_NAME)"; GENERATE_INFOPLIST_FILE = YES; CODE_SIGN_STYLE = Automatic; TEST_HOST = "$(BUILT_PRODUCTS_DIR)/Riji.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/Riji"; BUNDLE_LOADER = "$(TEST_HOST)"; LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";',
);
const appTarget = add(
  "AppTarget",
  `isa = PBXNativeTarget; name = Riji; productName = Riji; productReference = ${app}; productType = "com.apple.product-type.application"; buildConfigurationList = ${appConfig}; buildPhases = ${list([sources, frameworks, resources])}; buildRules = (); dependencies = ();`,
);
const proxy = add(
  "TestProxy",
  `isa = PBXContainerItemProxy; containerPortal = ${id("Project")}; proxyType = 1; remoteGlobalIDString = ${appTarget}; remoteInfo = Riji;`,
);
const dependency = add(
  "TestDependency",
  `isa = PBXTargetDependency; target = ${appTarget}; targetProxy = ${proxy};`,
);
const testTarget = add(
  "TestTarget",
  `isa = PBXNativeTarget; name = RijiTests; productName = RijiTests; productReference = ${test}; productType = "com.apple.product-type.bundle.unit-test"; buildConfigurationList = ${testConfig}; buildPhases = ${list([testSources])}; buildRules = (); dependencies = ${list([dependency])};`,
);
const project = add(
  "Project",
  `isa = PBXProject; attributes = { LastUpgradeCheck = 1640; TargetAttributes = { ${testTarget} = { TestTargetID = ${appTarget}; }; }; }; buildConfigurationList = ${shared}; compatibilityVersion = "Xcode 14.0"; developmentRegion = zh_CN; knownRegions = (en, Base, zh_CN); mainGroup = ${main}; productRefGroup = ${products}; projectDirPath = ""; projectRoot = ""; targets = ${list([appTarget, testTarget])};`,
);
fs.mkdirSync(path.join(root, "Riji.xcodeproj/xcshareddata/xcschemes"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(root, "Riji.xcodeproj/project.pbxproj"),
  `// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n${objects.join("\n")}\n}; rootObject = ${project}; }\n`,
);
const reference = (target, name) =>
  `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${target}" BuildableName="${name}" BlueprintName="${name.split(".")[0]}" ReferencedContainer="container:Riji.xcodeproj"/>`;
fs.writeFileSync(
  path.join(root, "Riji.xcodeproj/xcshareddata/xcschemes/Riji.xcscheme"),
  `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1640" version="1.3">
<BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
<BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${reference(appTarget, "Riji.app")}</BuildActionEntry>
<BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">${reference(testTarget, "RijiTests.xctest")}</BuildActionEntry>
</BuildActionEntries></BuildAction>
<TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">${reference(testTarget, "RijiTests.xctest")}</TestableReference></Testables></TestAction>
<LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="NO"><BuildableProductRunnable runnableDebuggingMode="0">${reference(appTarget, "Riji.app")}</BuildableProductRunnable></LaunchAction>
<ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">${reference(appTarget, "Riji.app")}</BuildableProductRunnable></ProfileAction>
<AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>\n`,
);
