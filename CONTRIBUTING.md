# 参与日跻

欢迎提交使用问题、界面改进和动作演示的具体修正。请在 Issue 中说明 App 版本、Android 版本、复现步骤和预期表现；不要上传真实训练备份、签名文件或个人信息。

## 本地运行

需要 Node.js 22 或更新版本。浏览器预览用于开发，训练数据位于当前浏览器的本地存储，与 Android App 相互独立。

```sh
npm ci
npm run prepare:media
npm run dev
```

打开 `http://127.0.0.1:8766`。准备命令联网获取约 1 MB 的固定版本兼容插图并验证哈希；App 运行本身不联网。80 份自制动画已经随源码附带。

若访问 GitHub 原始文件需要代理，请在运行命令的终端设置自己的 `HTTPS_PROXY`。此时准备脚本调用系统 `curl` 使用该代理，并继续执行同样的哈希检查；不要把代理凭据写入项目文件。

## 验证

```sh
npm test
npx playwright install chromium
npx playwright test
```

已有 Edge 的环境也可设置 `PLAYWRIGHT_CHANNEL=msedge` 运行浏览器测试。测试使用隔离的浏览器上下文，不在日常使用的 App 中写入记录。

## Android 构建

使用 JDK 17、Android SDK Platform 36、Build Tools 36.0.0。将 `JAVA_HOME`、`ANDROID_HOME` 指向自己的工具链；也可用不提交的 `local.properties` 设置 `sdk.dir`。Gradle 首次运行需要联网下载依赖。

```sh
./gradlew :app:assembleDebug :app:assembleRelease :app:lintRelease
```

Windows 使用 `./gradlew.bat`。Debug 包为 `app/build/outputs/apk/debug/app-debug.apk`；Release 未签名包为 `app/build/outputs/apk/release/app-release-unsigned.apk`。下载页的安装包由维护者在本地使用项目原签名签署，私钥不在仓库或 CI 中。

自行构建的 Debug/自签名包不能覆盖不同签名的下载版。开发时使用独立测试设备，或在自己的开发分支设置独立 `applicationIdSuffix`。升级日常使用的 App 前先通过系统文件选择器导出 JSON 备份；不要为测试卸载或清空数据。

## 代码与素材

- `app/src/main/assets/`：离线界面、数据逻辑、动作库与动画。
- `app/src/main/java/`：受限 WebView、原子存储、备份导入导出与启动屏。
- `tests/`：数据、素材完整性、浏览器流程和品牌布局检查。
- `art/exercise-library/`：80 个动画的制作脚本、清单、预览与技术验证。
- `docs/`：GitHub Pages 介绍页和公开文档。
- `downloads/`：已签名的公开安装包及 SHA-256 校验文件。

修改动画时先定位 `art/exercise-library/specs.json` 中的 ID，按 [制作说明](art/exercise-library/README.md) 只处理目标动作。修改后保留许可与哈希，执行 `node scripts/import-animations.cjs` 和素材测试。动作是否规范需要专门复核，不能以渲染成功替代。

先运行覆盖变更范围的检查，再提交清楚说明问题、修改与验证结果的 Pull Request。原创贡献按 MIT 许可提交，第三方内容必须注明实际来源及许可。
