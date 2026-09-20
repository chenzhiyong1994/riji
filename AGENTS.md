# 日跻开源项目

日跻是离线、无需账号的 Android / iOS 训练记录 App。功能与使用方法见 `README.md`，开发入口见 `CONTRIBUTING.md`。

- 保持包名 `local.jilian.app`、动作 ID、训练存储和 JSON 备份兼容；不新增登录或在线功能，除非明确提出。
- UI 位于 `app/src/main/assets/app.js`、`styles.css`；数据行为在 `core.js`；原生宿主在 `app/src/main/java/local/jilian/app/MainActivity.java`。
- iOS 宿主与工程位于 `ios/`，复用同一 assets 和 JSON 备份格式；Mac 上使用 `bash scripts/test-ios.sh`、`bash scripts/build-ios.sh`，分发边界见 `docs/ios.md`。下载的未签名 IPA 必须明确标注需个人签名，不能宣称可直接安装。
- 不提交签名密钥、密码、用户训练数据或本机配置。更新安装沿用同一签名，不卸载、不清数据。
- `tests/android-smoke.cjs` 仅可用于空白测试安装。已有训练的设备只做只读检查；行为测试在隔离浏览器中进行。
- 80 个动作动画仍待姿势复核。只修改涉及的动作，技术检查通过不等于动作姿势合格。
- 保留人体资产的 CC0 许可、来源和逐文件哈希。App 与介绍页不展示上游署名，来源记录留在源码；不重新引入已移除的静态图库或原 APK 媒体。
- 验证入口：`npm ci`、`npm test`、`npx playwright install chromium`、`npx playwright test`、`./gradlew :app:assembleRelease :app:lintRelease`。
- 发布前查看完整 diff、运行适用检查并本地提交。公开推送须完成实际内容与凭证审计，精确发布预定分支。
