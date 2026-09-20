# 下载日跻

## Android

[下载 Riji-1.1.3.apk](https://github.com/chenzhiyong1994/riji/raw/refs/heads/main/downloads/Riji-1.1.3.apk) · [校验文件](SHA256SUMS.txt) · [版本说明](../CHANGELOG.md)

Android 8.0 及以上，建议保持 Android System WebView 更新。安装包 60,646,968 字节（57.8 MiB），版本 `1.1.3` / versionCode `11`，包名 `local.jilian.app`。

下载后打开 APK，根据系统提示为当前下载工具允许安装。已安装同签名日跻的用户可以覆盖更新，升级前建议导出备份；不要先卸载。训练数据只保存在本机，卸载会删除本地数据。

SHA-256：

```text
0f76b749264a12187aaa7af080a55f243d7547ab5f854ed4f7f463f3a9af0337
```

Windows 使用 `Get-FileHash ./Riji-1.1.3.apk -Algorithm SHA256`；Linux 使用 `sha256sum -c SHA256SUMS.txt`；macOS 使用 `shasum -a 256 Riji-1.1.3.apk`。

## iOS / iPadOS

[下载 Riji-1.1.3-ios-unsigned.ipa](https://github.com/chenzhiyong1994/riji/raw/refs/heads/main/downloads/Riji-1.1.3-ios-unsigned.ipa) · [安装步骤](../docs/ios.md) · [校验文件](SHA256SUMS.txt)

支持 iOS / iPadOS 16.0+，版本 `1.1.3` / build `1`，ARM64 真机包，60,481,099 字节（57.7 MiB）。**IPA 未签名，需要使用自己的账号和工具签名后安装，不能下载后直接点开安装。** 更新时沿用个人签名身份与 Bundle Identifier，先导出备份，不要先卸载。

Windows 使用 `Get-FileHash ./Riji-1.1.3-ios-unsigned.ipa -Algorithm SHA256`；macOS 使用 `shasum -a 256 Riji-1.1.3-ios-unsigned.ipa`。与上方校验文件中的同名条目比较。校验值对应未签名原包，个人签名后会发生变化。

两个平台的安装包均包含全部离线动作动画，无需额外下载；JSON 备份互通。素材来源与许可记录见 [源码说明](../THIRD_PARTY_NOTICES.md)。
