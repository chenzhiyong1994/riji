const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../app/src/main/assets/core.js");
const templates = require("../app/src/main/assets/training-templates.js");
const catalog = [
  { id: "bench", name: "卧推", category: "胸", mode: "weight" },
  { id: "plank", name: "平板支撑", category: "腹", mode: "time" },
];
const program = {
  name: "入门",
  schedule: "每周两天，间隔休息。",
  guidance: "先完成动作，再增加负荷。",
  sessions: [
    {
      name: "全身 A",
      exerciseIds: ["bench", "plank"],
      targets: {
        bench: { sets: 2, reps: 10, seconds: 0, restSeconds: 90 },
        plank: { sets: 2, reps: 0, seconds: 20, restSeconds: 60 },
      },
    },
  ],
};

test("添加模板生成独立个人计划，编辑和再次添加不影响模板或已有训练", () => {
  const before = C.startWorkout(C.initialState());
  const next = C.addProgram(before, program, catalog);
  assert.equal(before.plans.length, 0);
  assert.deepEqual(next.active, before.active);
  assert.equal(next.plans[0].name, "入门 · 全身 A");
  next.plans[0].targets.bench.reps = 8;
  const again = C.addProgram(next, program, catalog);
  assert.equal(again.plans.length, 2);
  assert.notEqual(again.plans[0].id, again.plans[1].id);
  assert.notEqual(again.plans[0].name, again.plans[1].name);
  assert.equal(again.plans[1].targets.bench.reps, 10);
  assert.equal(program.sessions[0].targets.bench.reps, 10);
  assert.deepEqual(C.importBackup(C.exportBackup(again)), again);
  assert.throws(() => C.addProgram(before, program, []));
  assert.equal(before.plans.length, 0);
});

test("计划目标优先于上次组数次数，重量仍可复用，计时和休息在重启后保留", () => {
  let s = C.addProgram(C.initialState(), program, catalog);
  s = C.startWorkout(s);
  s = C.addExercise(s, "bench", catalog);
  const e = s.active.exercises[0];
  s = C.updateSet(s, e.id, e.sets[0].id, {
    weight: 40,
    reps: 5,
    done: true,
    type: "drop",
  });
  s = C.finishWorkout(s);
  const next = C.startPlan(s, s.plans[0], catalog);
  assert.equal(next.active.exercises[0].sets.length, 2);
  assert.equal(next.active.exercises[0].sets[0].weight, 40);
  assert.equal(next.active.exercises[0].sets[0].reps, 10);
  assert.equal(next.active.exercises[0].sets[0].type, "normal");
  assert.equal(next.active.exercises[0].sets[0].done, false);
  assert.equal(next.active.exercises[1].sets[0].seconds, 20);
  assert.equal(next.active.exercises[1].restSeconds, 60);
  assert.match(next.active.notes, /每周两天/);
  assert.deepEqual(C.restore(JSON.stringify(next)), next);
  const legacy = C.startPlan(
    s,
    { name: "旧计划", exerciseIds: ["bench"] },
    catalog,
  );
  assert.equal(legacy.active.exercises[0].sets.length, 1);
  assert.equal(legacy.active.exercises[0].sets[0].reps, 5);
});

test("非法目标和超限添加原子拒绝，旧备份仍按原样恢复", () => {
  const s = C.addProgram(C.initialState(), program, catalog);
  for (const patch of [
    { sets: 0 },
    { sets: 21 },
    { reps: 1.5 },
    { seconds: -1 },
    { restSeconds: 3601 },
  ]) {
    const bad = C.clone(s);
    Object.assign(bad.plans[0].targets.bench, patch);
    assert.throws(() => C.importBackup(C.exportBackup(bad)));
    assert.throws(() => C.savePlan(s, bad.plans[0]));
  }
  const full = C.initialState();
  full.plans = Array.from({ length: 499 }, (_, i) => ({
    id: String(i),
    name: "旧计划",
    exerciseIds: ["bench"],
  }));
  assert.throws(() =>
    C.addProgram(
      full,
      { ...program, sessions: [...program.sessions, ...program.sessions] },
      catalog,
    ),
  );
  assert.equal(full.plans.length, 499);
  assert.deepEqual(C.importBackup(C.exportBackup(full)), full);
});

test("所有内置场景使用现役动作，均可添加、启动和备份恢复", () => {
  const fs = require("node:fs"),
    vm = require("node:vm"),
    context = { window: {} };
  vm.runInNewContext(
    fs.readFileSync("app/src/main/assets/catalog.js", "utf8"),
    context,
  );
  const movements = context.window.MOVEMENTS;
  assert.equal(templates.length, 8);
  assert.equal(new Set(templates.map((p) => p.id)).size, 8);
  const modes = new Set();
  for (const p of templates) {
    let s = C.addProgram(C.initialState(), p, movements);
    s = C.importBackup(C.exportBackup(s));
    for (const plan of s.plans) {
      assert.equal(new Set(plan.exerciseIds).size, plan.exerciseIds.length);
      const started = C.startPlan(s, plan, movements);
      for (const e of started.active.exercises) {
        modes.add(e.mode);
        assert.equal(e.sets.length, plan.targets[e.exerciseId].sets);
        assert.ok(
          e.mode === "time" ? e.sets[0].seconds > 0 : e.sets[0].reps > 0,
        );
        assert.equal(e.sets[0].weight, 0);
        assert.equal(e.sets[0].done, false);
      }
      assert.deepEqual(C.restore(JSON.stringify(started)), started);
    }
  }
  assert.ok(modes.has("time"));
  assert.ok(modes.has("weight"));
});

test("记录方式与目标不匹配时拒绝启动，原计划和正在训练的数据不变", () => {
  const s = C.addProgram(C.initialState(), program, catalog);
  const changedCatalog = catalog.map((e) =>
    e.id === "bench" ? { ...e, mode: "time" } : e,
  );
  assert.throws(
    () => C.startPlan(s, s.plans[0], changedCatalog),
    /目标.*记录方式/,
  );
  assert.equal(s.active, null);
  assert.equal(s.plans[0].targets.bench.reps, 10);
});
