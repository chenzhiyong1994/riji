# 第三方素材与许可

根目录 MIT 许可适用于本项目原创代码、文档、Logo 和自制动画中的原创部分；它不替代以下上游许可。品牌名称不表示对衍生项目的背书。

## MakeHuman 图形资产

人体网格、形态目标、骨架及蒙皮权重来自 MakeHuman，固定版本 `a8bc2d54ff0ac92e78ff71431b1023eda42bf482`，使用 CC0 1.0 图形资产许可。动画、器械和肌群材质由本项目制作。

- [逐文件来源与哈希](art/muscle-preview/refined-curl/source/manifest.json)
- [CC0 完整许可](app/src/main/assets/licenses/makehuman-cc0.txt)
- [MakeHuman 许可说明](https://static.makehumancommunity.org/about/license.html)

来源目录中的 `LICENSE.md` 说明 MakeHuman 上游程序许可；本项目取用的是 CC0 图形资产，未集成 MakeHuman 程序。

## RepDB 免费静态插图

**Exercise data by [RepDB (repdb.co)](https://repdb.co)**。

安装包内保留 61 张免费静态插图，作为旧记录的兼容与回退配图。来源为 RepDB 官方仓库固定提交 `b25c9bc82cab09082b34dce3285bb32f9d45402a`，适用 [Free Tier License v1.0](app/src/main/assets/licenses/repdb-free-tier.md)。该许可允许带署名的应用内使用，禁止重新分发为数据集/API，以及生成式 AI 衍生处理。

源码仓库不单独分发这些图片。构建准备命令仅从固定上游恢复已登记的文件并逐项验证 SHA-256；不下载完整数据集或付费预览动画。不要将准备后的图片目录另行发布为数据集。App 关于页、此文件与 README 均保留署名。

- [应用内映射、来源 URL 与哈希](app/src/main/assets/media-manifest.json)
- [上游原始许可](https://github.com/RepDB/exercise-dataset/blob/b25c9bc82cab09082b34dce3285bb32f9d45402a/LICENSE-DATA.md)

## 开发工具

Gradle Wrapper 使用 [Apache License 2.0](licenses/Apache-2.0.txt)，Copyright Gradle, Inc. and contributors。Wrapper JAR 由 Gradle 8.14.5 生成，SHA-256 与官方发布指纹一致。Node 开发依赖的确切版本与来源见 `package-lock.json`，各依赖保留自身许可证；它们不打包进 App。

## 封面

`docs/assets/cover.png` 使用本项目 C「跃线」Logo，通过 OpenAI ImageGen 生成品牌封面；未使用第三方动作图片作为生成输入。生成说明见 [封面记录](docs/cover-design.md)。页面内的 App 截图来自隔离浏览器中的虚构演示数据。
