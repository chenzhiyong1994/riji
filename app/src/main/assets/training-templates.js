(function (root, factory) {
  const templates = factory();
  if (typeof module === "object") module.exports = templates;
  else root.TRAINING_TEMPLATES = templates;
})(this, function () {
  "use strict";
  // 固定动作 ID；每项为 [ID, 组数, 次数或秒数, 休息秒数, 是否计时]。
  const session = (name, rows, notes = "") => ({
    name,
    notes,
    exerciseIds: rows.map((row) => row[0]),
    targets: Object.fromEntries(
      rows.map(([id, sets, amount, restSeconds, timed]) => [
        id,
        {
          sets,
          reps: timed ? 0 : amount,
          seconds: timed ? amount : 0,
          restSeconds,
        },
      ]),
    ),
  });
  const squat = "11971201-Squat-m_Thighs_small.mp4";
  const goblet = "17601201-Dumbbell-Goblet-Squat_Thighs";
  const deadbug = "02761201-Dead-Bug_Waist";
  const common =
    "先热身 5–10 分钟；主动作先做轻负荷热身组。选择动作稳定、做完仍有余力的重量；自重动作重量填 0。完成质量稳定后再小幅增加负荷，不必每组力竭。";
  return [
    {
      id: "starter-gym",
      name: "健身房入门",
      level: "入门",
      goal: "建立习惯",
      equipment: "健身房",
      duration: "35–45 分钟",
      frequency: "每周 2 天",
      description: "以器械为主，先熟悉全身推、拉和下肢动作。",
      schedule: "每周练 A、B 各一次，例如周一 A、周四 B，中间留出恢复日。",
      guidance:
        "适合刚开始训练或停练后重新建立习惯。前两周先适应动作，组间休息不足时可延长。",
      sessions: [
        session("全身 A", [
          ["legpress_machine", 2, 10, 90],
          ["machinepress", 2, 10, 90],
          ["sit_cable_row", 2, 10, 90],
          ["leg_curl_linedown", 2, 10, 90],
          ["plank_recorder", 2, 20, 60, true],
        ]),
        session(
          "全身 B",
          [
            [goblet, 2, 10, 90],
            ["machine_pulldown", 2, 10, 90],
            ["machineshoulderpress", 2, 10, 90],
            ["f_s_f294", 2, 12, 60],
            [deadbug, 2, 10, 60],
          ],
          "死虫次数按左右合计记录。",
        ),
      ],
    },
    {
      id: "home-bodyweight",
      name: "居家徒手起步",
      level: "入门",
      goal: "建立习惯",
      equipment: "居家徒手",
      duration: "20–30 分钟",
      frequency: "每周 2–3 天",
      description: "一块空地，从下肢、推类和核心开始活动。",
      schedule: "每周重复 2–3 次，两次之间安排恢复日。",
      guidance:
        "跪姿俯卧撑可按能力减少次数。此组合缺少拉类训练，有器械条件后可加入划船或下拉。",
      sessions: [
        session(
          "基础活动",
          [
            [squat, 2, 10, 60],
            ["knee-push-up-fz", 2, 8, 90],
            ["f_s_f294", 2, 12, 60],
            [deadbug, 2, 10, 60],
            ["plank_recorder", 2, 20, 60, true],
          ],
          "死虫次数按左右合计记录。",
        ),
      ],
    },
    {
      id: "dumbbell-muscle",
      name: "哑铃全身增肌",
      level: "有基础",
      goal: "增肌",
      equipment: "哑铃训练",
      duration: "40–55 分钟",
      frequency: "每周 3 天",
      description: "用哑铃与训练凳安排全身训练，A / B 交替。",
      schedule:
        "例如周一 A、周三 B、周五 A；下一周 B / A / B，训练日之间休息。",
      guidance:
        "需要一对哑铃及稳固训练凳。单侧划船两侧各完成所列次数后记一组；每次只小幅调整一个训练变量。",
      sessions: [
        session("全身 A", [
          [goblet, 3, 10, 120],
          ["dumbellpress", 3, 10, 120],
          ["dumbellrowbench", 3, 10, 90],
          ["laderrow", 2, 12, 60],
          ["plank_recorder", 2, 30, 60, true],
        ]),
        session("全身 B", [
          [goblet, 3, 12, 120],
          ["f_s_f294", 3, 15, 90],
          ["shoulderpress", 3, 10, 120],
          ["dumbellrowbench", 3, 10, 90],
          ["dumbbellcurl", 2, 12, 60],
          ["Dumbbell-Standing-Calf-Raise", 2, 15, 60],
        ]),
      ],
    },
    {
      id: "upper-lower",
      name: "上下肢四日增肌",
      level: "有基础",
      goal: "增肌",
      equipment: "健身房",
      duration: "50–70 分钟",
      frequency: "每周 4 天",
      description: "上下肢各练两次，将训练量分散到一周。",
      schedule:
        "例如周一上肢 A、周二下肢 A、周四上肢 B、周五下肢 B，其余天恢复。",
      guidance:
        "适合能稳定完成基础动作、可每周训练四天的人。恢复不足时先减少辅助动作组数。",
      sessions: [
        session("上肢 A", [
          ["benchpress", 3, 8, 150],
          ["sit_cable_row", 3, 10, 120],
          ["upperdumbellpress", 2, 10, 120],
          ["pulldown", 2, 10, 120],
          ["laderrow", 2, 12, 60],
          ["vbar_pulldown", 2, 12, 60],
        ]),
        session("下肢 A", [
          ["squat", 3, 8, 180],
          ["romaniadeadlift", 3, 10, 150],
          ["legextendtion", 2, 12, 90],
          ["leg_curl_linedown", 2, 12, 90],
          ["Dumbbell-Standing-Calf-Raise", 3, 12, 60],
        ]),
        session("上肢 B", [
          ["dumbellpress", 3, 10, 120],
          ["pulldown", 3, 10, 120],
          ["machinefly", 2, 12, 90],
          ["machinerowling", 2, 10, 120],
          ["shoulderpress", 2, 10, 120],
          ["dumbbellcurl", 2, 12, 60],
        ]),
        session("下肢 B", [
          ["legpress_machine", 3, 10, 150],
          ["hiptrust", 3, 10, 150],
          ["Lever-Seated-Leg", 3, 12, 90],
          ["legextendtion", 2, 12, 90],
          ["plank_recorder", 3, 30, 60, true],
        ]),
      ],
    },
    {
      id: "basic-strength",
      name: "基础力量进阶",
      level: "进阶",
      goal: "提升力量",
      equipment: "健身房",
      duration: "50–65 分钟",
      frequency: "每周 3 天",
      description: "低次数主动作配合充分休息，练习稳定发力。",
      schedule:
        "A / B 隔日交替，每周三次；例如本周 A / B / A，下周 B / A / B。",
      guidance:
        "需已掌握深蹲、卧推、硬拉与推举技术。使用安全架或保护，不安排极限测试；完成全部目标且动作稳定后再小幅加重。",
      sessions: [
        session("力量 A", [
          ["squat", 3, 5, 180],
          ["benchpress", 3, 5, 180],
          ["barbellrow", 3, 8, 150],
          ["plank_recorder", 2, 30, 60, true],
        ]),
        session("力量 B", [
          ["deadlift", 2, 5, 180],
          ["barbell_showlderpress", 3, 5, 180],
          ["legpress_machine", 3, 8, 150],
          ["pulldown", 3, 8, 120],
        ]),
      ],
    },
    {
      id: "push-pull-legs",
      name: "推拉腿分化",
      level: "进阶",
      goal: "增肌",
      equipment: "健身房",
      duration: "45–65 分钟",
      frequency: "每周 3–6 天",
      description: "按推、拉、腿拆分，适合已有规律训练经验的人。",
      schedule:
        "先按每周推 / 拉 / 腿各一次执行；适应且恢复充足后可推 / 拉 / 腿 / 休 / 推 / 拉 / 腿循环。",
      guidance:
        "训练频率增加时不要同时增加每次组数。每周只有三天且希望更频繁覆盖全身时，可选择哑铃全身模板。",
      sessions: [
        session("推", [
          ["benchpress", 3, 8, 150],
          ["upperdumbellpress", 3, 10, 120],
          ["shoulderpress", 2, 10, 120],
          ["laderrow", 2, 12, 60],
          ["vbar_pulldown", 2, 12, 60],
        ]),
        session("拉", [
          ["pulldown", 3, 10, 120],
          ["barbellrow", 3, 10, 150],
          ["sit_cable_row", 2, 12, 90],
          ["face-pullingg", 2, 12, 60],
          ["dumbbellcurl", 2, 12, 60],
        ]),
        session("腿", [
          ["squat", 3, 8, 180],
          ["romaniadeadlift", 3, 10, 150],
          ["legextendtion", 2, 12, 90],
          ["leg_curl_linedown", 2, 12, 90],
          ["Dumbbell-Standing-Calf-Raise", 3, 15, 60],
        ]),
      ],
    },
    {
      id: "conditioning",
      name: "力量与有氧结合",
      level: "入门",
      goal: "减脂与体能",
      equipment: "健身房",
      duration: "40–55 分钟",
      frequency: "每周 2–3 天",
      description: "全身力量后配合单车，逐步建立活动量。",
      schedule: "每周 2–3 次，训练日间隔恢复；其他天可安排轻松步行。",
      guidance:
        "单车以能交谈的强度开始，可按体能缩短时间。本模板只覆盖部分周活动量；体重变化也取决于长期饮食与总活动量。",
      sessions: [
        session("力量 + 单车", [
          ["legpress_machine", 2, 12, 90],
          ["machinepress", 2, 10, 90],
          ["sit_cable_row", 2, 10, 90],
          ["f_s_f294", 2, 12, 60],
          ["bike", 1, 900, 0, true],
        ]),
      ],
    },
    {
      id: "short-session",
      name: "忙碌日二十分钟",
      level: "有基础",
      goal: "建立习惯",
      equipment: "哑铃训练",
      duration: "约 20 分钟",
      frequency: "时间紧张时",
      description: "压缩动作数量，在忙碌的一天保留训练习惯。",
      schedule:
        "作为时间紧张时的一次替代训练；根据前后两天的安排调整，避免重复高负荷训练同一部位。",
      guidance:
        "备好哑铃和稳固支撑凳。时间不足时减少组数，不省略热身；单侧划船两侧各做完所列次数后记一组。",
      sessions: [
        session("精简全身", [
          [goblet, 2, 10, 90],
          ["pushup-xunji", 2, 8, 90],
          ["dumbellrowbench", 2, 10, 90],
        ]),
      ],
    },
  ].map((program) => ({
    ...program,
    guidance: common + "\n" + program.guidance,
  }));
});
