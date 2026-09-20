# iOS 版

iOS 版使用 Swift / WKWebView 原生宿主，复用 Android 1.1.3 的完整离线界面、80 个动作动画、训练模板与数据逻辑。支持 iPhone / iPad，最低 iOS / iPadOS 16.0。两端使用同一 JSON 备份格式，可手动导出后在另一台设备导入；没有云同步。

## 下载包与安装条件

[下载 iOS IPA](https://github.com/chenzhiyong1994/riji/raw/refs/heads/main/downloads/Riji-1.1.3-ios-unsigned.ipa) · [SHA-256 校验](../downloads/SHA256SUMS.txt)

GitHub 分发的 `Riji-1.1.3-ios-unsigned.ipa` 是供个人签名的未签名 ARM64 真机包。**它不能在 Safari 中下载后直接点开安装，也不是 App Store / TestFlight 版本。** 安装需要在用户自己的设备和账号下完成签名。

- 有 Mac：使用 Xcode 打开 `ios/Riji.xcodeproj`，在 Signing & Capabilities 选择自己的 Team，连接 iPhone 后运行。若包名已被其他开发者团队占用，需为个人构建改用自己唯一的 Bundle Identifier。
- 使用 IPA：通过自己信任且支持个人签名的侧载工具签名并安装。签名时提供的 Apple 账号不属于日跻 App 的账号，日跻本身仍无需登录。有效期、可安装设备与续签频率由实际签名方式决定。
- 更新时沿用个人签名身份与 Bundle Identifier，并先导出 JSON 备份。不要为更新先卸载。签名过期后按所用工具续签；更换包名会被视为另一款 App，需自行导入备份。

Apple 官方说明：[从 Xcode 运行到设备](https://developer.apple.com/documentation/xcode/running-your-app-in-simulator-or-on-a-device)、[分发方式](https://help.apple.com/xcode/mac/current/en.lproj/dev31de635e5.html)。本项目不提供企业签名或通用免签安装承诺。

Windows 用户可参考 [AltStore Classic 官方安装说明](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows)：先按官方步骤配置 AltServer 和 iPhone，再在 AltStore Classic 的 My Apps 中通过「+」选择下载的 IPA。按工具提示完成个人签名，并维持所需的定期刷新；本项目尚未实机验证这条安装路径。工具行为以其官方文档为准。

## 使用与数据

训练、计划、历史、自定义动作、身体数据和主题与 Android 共用实现。在「我的」通过系统「文件」选择器导入或导出 JSON。导入须先通过格式验证，再在 App 内确认替换。备份上限为 16 MiB；导出文件没有额外加密，请保存在可信位置。

原生宿主将训练数据原子写入私有 Application Support 文件，写入成功后界面才确认保存。该目录排除系统备份，WKWebView 使用非持久化网站数据存储。卸载应用会删除本机记录，需自行导出备份。选择 iCloud Drive 或其他文件提供商导出时，由系统和相应提供商处理所选文件。

运行资源全部来自安装包；CSP、原生导航白名单和内容阻断规则限制外部访问。不集成广告、统计或登录 SDK。进入后台暂停动作动画；休息计时回到前台按实际时间恢复，暂不提供锁屏提醒音。

## 构建与验证

需要 Mac、Xcode 16 或更新版本及已安装的 iOS SDK / Simulator。无需 CocoaPods、第三方 Swift 库或 Apple 签名材料即可运行模拟器测试和构建未签名 IPA。

```sh
bash scripts/test-ios.sh
bash scripts/build-ios.sh
```

构建输出为 `release/Riji-1.1.3-ios-unsigned.ipa` 和同名 `.sha256`。脚本核对 ARM64 真机架构、最低系统版本、包名、无签名材料，以及全部离线资源与源码逐字节一致。GitHub Actions 的 iOS 工作流执行同样步骤，测试失败时不上传安装包。

原生集成测试运行实际 WKWebView，覆盖记录训练、重建宿主后恢复、JSON 备份导入、失败写入、离线动画、系统文件选择器与外部导航阻断。`npm test` 另覆盖 JavaScript 桥接的同步保存确认与文本传递；现有浏览器测试覆盖共用完整流程。

本次构建、校验值、模拟器截图与测试边界见 [iOS 1.1.3 验证记录](validation-ios.md)。

项目文件已提交，可直接用 Xcode 打开。新增原生源文件后维护 `scripts/generate-ios-project.cjs`，运行 `node scripts/generate-ios-project.cjs` 重新生成工程。App 图标由既有 `brand-mark.svg` 加深色底色导出，不引入新品牌素材。

实体 iPhone / iPad、个人签名安装、系统文件提供商的实际导入导出，以及最低 iOS 16 版本仍需实机验证；模拟器通过不能替代这些检查。80 份动画姿势仍待复核。
