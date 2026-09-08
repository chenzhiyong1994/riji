# 第三方素材与许可

根目录 MIT 许可适用于本项目原创代码、文档、Logo 和自制动画中的原创部分；它不替代以下上游许可。品牌名称不表示对衍生项目的背书。

## MakeHuman 图形资产

人体网格、形态目标、骨架及蒙皮权重来自 MakeHuman，固定版本 `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`，使用 CC0 1.0 图形资产许可。动画、器械和肌群材质由本项目制作。

- [逐文件来源与哈希](art/muscle-preview/refined-curl/source/manifest.json)
- [CC0 完整许可](app/src/main/assets/licenses/makehuman-cc0.txt)
- [MakeHuman 许可说明](https://static.makehumancommunity.org/about/license.html)

上述 CC0 来源说明为维护记录；App 与介绍页无需展示署名。

来源目录中的 `LICENSE.md` 说明 MakeHuman 上游程序许可；本项目取用的是 CC0 图形资产，未集成 MakeHuman 程序。

## 旧版本素材记录

1.0.6 起不再使用或打包 RepDB 静态图，相关引用及下载脚本已移除。旧版 1.0.5 APK 曾按 [Free Tier License v1.0](https://github.com/RepDB/exercise-dataset/blob/b25c9bc82cab09082b34dce3285bb32f9d45402a/LICENSE-DATA.md) 使用 61 张应用内插图；该旧安装包继续保留当时的许可和署名，不作为图片数据集分发。

## 开发工具

Gradle Wrapper 使用 [Apache License 2.0](licenses/Apache-2.0.txt)，Copyright Gradle, Inc. and contributors。Wrapper JAR 由 Gradle 8.14.5 生成，SHA-256 与官方发布指纹一致。Node 开发依赖的确切版本与来源见 `package-lock.json`，各依赖保留自身许可证；它们不打包进 App。

## 封面

`docs/assets/cover.png` 使用本项目 C「跃线」Logo，通过 OpenAI ImageGen 生成品牌封面；未使用第三方动作图片作为生成输入。生成说明见 [封面记录](docs/cover-design.md)。页面内的 App 截图来自隔离浏览器中的虚构演示数据。
