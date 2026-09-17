# 动作要点维护

1.1.1 起，全部 80 个现役动作的详情包含发力重点、3 条动作要点、2 条常见误区及纠正办法。内容按动作分别编写，包括准备姿势、动作轨迹、呼吸、可控幅度及器械设置。用户通过“动作 → 动作详情”查看，无需网络。

1.1.2 调整详情排版：标题与底部操作固定，中间内容独立滚动；标签、动画与播放控制、文字指导、训练记录按顺序分区。阅读区限制宽度并统一边距，误区与纠正办法分行显示；自定义长说明使用同一布局。深浅主题共用绿色主题色，浅色文字使用更深的绿色保证白底可读性。

1.1.3 将播放/暂停改为动画右下角的浮层图标按钮，移除动画下方独立控制栏和循环/高亮状态文字。按钮保留无障碍名称、键盘焦点与播放状态，减少动态效果及后台暂停行为不变。

## 数据与兼容

- `app/src/main/assets/exercise-guidance.js` 按现役动作 ID 保存 `{ focus, steps, mistakes }`，独立于动作元数据与动画映射。
- `app.js` 在动画下方展示说明，同时提示动画仅作示意、可能存在变形。文字不能作为现有动画姿势已修正或验收通过的证明。
- `plan-king` 仅复用 `plank_recorder` 的文字；其原 ID、动画、记录方式继续保留。其余兼容元数据不批量补写或迁移。
- 自定义动作不套用内置要点，用户已有的 `notes` 保留并转义显示。查看说明不写入用户状态，存储与 JSON 备份结构不变。
- 动作名称沿用现有库；“窄距卧推(敞开式)”的说明明确使用拇指环握，不能因旧名称误用空握。

## 内容依据

2026-09-17 参考下列第一方资料整理通用原则与代表动作，再按现有动作和器械变式编写简洁中文说明；不是这些机构逐项审校或认证的 80 份教程，也不依据变形动画反推姿势。

| 范围 | 参考资料 |
| --- | --- |
| 可控负重、姿势、呼吸与疼痛时停止 | [Mayo Clinic：Weight training — Do's and don'ts](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/weight-training/art-20045842) |
| 卧推设置、握持和误区 | [NASM：Barbell Bench Press](https://www.nasm.org/resource-center/exercise-library/barbell-bench-press) |
| 上斜卧推、器械推胸、窄距卧推 | [ACE：Incline Chest Press](https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/)、[Seated Chest Press](https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/)、[Close-grip Bench Press](https://www.acefitness.org/resources/everyone/exercise-library/311/close-grip-bench-press/) |
| 深蹲、划船、腿弯举 | [ACE：Back Squat](https://www.acefitness.org/resources/everyone/exercise-library/11/back-squat/)、[Bent-over Row](https://www.acefitness.org/resources/everyone/exercise-library/12/bent-over-row/)、[Lying Hamstrings Curl](https://www.acefitness.org/resources/everyone/exercise-library/153/lying-hamstrings-curl/) |
| 硬拉与变式 | [ACE：The Deadlift](https://www.acefitness.org/continuing-education/certified/december-2024/8762/the-ace-do-it-better-series-the-deadlift/) |
| 弯举、锤式弯举、过头臂屈伸、三头下压 | [ACE：Bicep Curl](https://www.acefitness.org/resources/everyone/exercise-library/70/bicep-curl/)、[Hammer Curl](https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/)、[Triceps Extension](https://www.acefitness.org/resources/everyone/exercise-library/74/triceps-extension/)、[Triceps Pushdowns](https://www.acefitness.org/resources/everyone/exercise-library/185/triceps-pushdowns/) |
| 卷腹的发力与动作范围 | [ACE：Crunch](https://www.acefitness.org/resources/everyone/exercise-library/52/crunch/) |
| 划船机发力顺序和回程 | [Concept2：Rowing Technique](https://www.concept2.com/training/rowing-technique) |

## 更新与验证

修改具体动作时核对 ID、名称、器械及变式，优先修正明确有误的文字。避免“膝盖不能过脚尖”“肩胛始终锁死”等绝对化提示，不用统一话术替代动作区别。器械行程以实际设备说明和可控幅度为准。

`npm test` 核对 80 项完整覆盖和字段结构；浏览器测试逐项打开详情，检查离线加载、深浅主题、320px 窄屏、横屏、滚动后的关闭与加入训练、旧平板支撑、自定义长说明及浏览后存储不变。原生页面有改动时另做保留数据的模拟器检查，见 [1.1.3 发布验证](validation.md)。技术测试仅验证显示和兼容性，不验证人体动作质量。
