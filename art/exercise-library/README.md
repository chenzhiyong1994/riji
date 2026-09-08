# 日跻 · 80 个动作动画制作

80 个现役动作的候选动图已完成，用户随后要求先导入 App。1.0.4 已接入全库，仍保留待检查状态，后续按用户意见删除或修复不合理动作。沿用已确认的人体美术风格，但美术风格通过不代表关节朝向、握持和动作姿势已获认可。

## 制作与交付边界

- 以 `specs.json` 的 80 个现役 ID 为完整清单，每项独立编排动作、器械和主要/辅助高亮区域。同类变式可共享骨骼和运动求解器，但不能用重复动画冒充不同动作。
- 逐批产出动态 WebP、静态海报、关键姿势及验证数据；技术检查覆盖关节目标、循环、实际帧变化和红色高亮。手腕朝向、握持、支撑位置、动作合理性和肌群对应关系留待用户统一检查。
- 保留已批准的弯举样片和原始 CC0 资产。批量场景只读取这些图形资产，不使用原 APK 或 RepDB 图片生成动画。
- 所有 80 项完成制作检查和待验收预览，并按用户要求接入 App。检查页支持保留、修复或删除标记；接入不改写训练或自定义数据。

## 来源

基础人体、骨架和权重为 MakeHuman CC0 图形资产，锁定来源与哈希见 `../muscle-preview/refined-curl/source/manifest.json`；本地动画、器械与肌群材质为本项目制作。

动作编排参考 [ACE 动作库](https://www.acefitness.org/resources/everyone/exercise-library/)，包括 [高位下拉](https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/)、[背蹲](https://www.acefitness.org/resources/everyone/exercise-library/11/back-squat/)，以及 [NASM 死虫](https://www.nasm.org/resource-center/exercise-library/dead-bug)。仅参考文字动作说明，不下载或复制其图片和视频。高亮是主要参与肌群和动作阶段的美术示意，并非肌电测量。

## 当前状态

80 / 80 份完整候选动图已制作，附封面、缩略图、四姿势检查图和逐项验证记录。`output/manifest.json` 是成品清单；`production-validation.json` 记录整库制作检查；`browser-validation.json` 记录检查页的播放、筛选、备注保存和清单导出验证。App 接入清单为 `../../app/src/main/assets/animation-manifest.json`，可在 App 根目录运行 `node scripts/import-animations.cjs` 从原成品重新导入。

此前用户指出关节错位与手腕反向问题，旧的画面检查记录不能作为动作合格依据。全部成品仍标记为待用户检查，尤其需要核对手腕朝向、手掌握持、器械接触和肌群高亮位置。第 64 项调整了视角与暗部高亮，第 79 项修复了踏板回卷时突然出现造成的循环接缝；技术阈值保持不变，这些修正也不代表动作姿势已获确认。

## 生产和复核

在项目根目录使用安装了 NumPy、Pillow 的 Python 执行：

```powershell
python art/exercise-library/run_batch.py --resume
python art/exercise-library/export.py --contacts
python art/exercise-library/verify_library.py
node art/exercise-library/verify_preview.cjs
```

将 Blender 5.2 加入 PATH 或设置 `BLENDER_BIN`；安装 NumPy、Pillow。生成中文检查图时可设置 `RIJI_FONT` 指向自己的中文字体文件。`run_batch.py` 使用 Blender 5.2，每次只启动一个渲染进程，同时由两个独立进程编码；可用 `--encoders 1` 减少 CPU 使用。`--only 1,2` 可重做指定序号，`--resume` 跳过版本和哈希匹配的完整成品，并复用中断前已完成的整段渲染。`--preview` 只输出四张关键姿势，并拒绝覆盖已完成的整段渲染。骨骼预检可运行 Blender 入口 `produce.py -- --motion-only`。

每项为 768 × 896、72 帧、24 fps、3 秒循环 WebP；包含静态封面、160 × 186 缩略图、四姿势检查图和逐项验证。原已确认的第 53 项哑铃弯举保留其动图原文件。其余采用同一连续蒙皮人体和 19 个肌群分区，暗部动作单独加强红色可见性；等长支撑采用轻微呼吸与高亮变化。

输出必须通过完整帧数、解码后的不同帧、总时长、循环边界、红色明暗变化、实际骨骼位置及不可达关节检查。实际查看关键姿势后，使用 `verify_library.py --partial --reviewed 1,2` 登记渲染画面检查；它只核对画面是否输出、人体和器械是否显示，不代表动作合理性通过。`verify_library.py` 在 80 项均存在且完成画面检查后输出制作报告，仍明确标记 `poseAcceptance: pending_user_review`；`integrated` 按 App 媒体清单中的动作 ID 和动画哈希核对，接入不代表动作验收通过。

预览库支持动作名称/编号搜索、分类筛选、一次播放一个动画、放大原尺寸动图、查看关键姿势、保留/修复/删除标记与备注，以及导出 JSON 检查清单。意见保存在当前浏览器；动画哈希变化后状态恢复为待检查，旧备注保留供复查。标记不会直接删除任何源文件或修改 App。

直接打开 `preview.html` 即可使用，也可执行 `node art/exercise-library/serve_preview.cjs`（App 目录下）后访问 `http://127.0.0.1:8767/`。服务仅监听本机地址；生产过程中刷新页面可看到新完成的文件。

`renders/`、`cache/`、日志及中间 Blender 场景不进入 Git；可由受版本管理的规格、脚本和已锁定人体源文件重建。最终 WebP、封面、缩略图、关键姿势和验证清单进入版本管理。
