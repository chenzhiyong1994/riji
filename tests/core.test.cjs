const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../app/src/main/assets/core.js");
const catalog = [{ id: "bench", name: "卧推", category: "胸", mode: "weight" }];
test("完成训练只统计已完成组，重开后可继续未完成训练", () => {
  let s = C.initialState();
  s = C.startWorkout(s, { title: "推训练", date: "2026-09-07" }, catalog);
  s = C.addExercise(s, "bench", catalog);
  const e = s.active.exercises[0];
  s = C.updateSet(s, e.id, e.sets[0].id, { weight: 60, reps: 10, done: true });
  s = C.updateSet(s, e.id, e.sets[1].id, { weight: 70, reps: 8, done: true });
  s = C.updateSet(s, e.id, e.sets[2].id, { weight: 999, reps: 10 });
  s = C.restore(JSON.stringify(s));
  assert.equal(C.workoutStats(s.active).volume, 1160);
  s = C.finishWorkout(s);
  assert.equal(s.active, null);
  assert.equal(s.sessions.length, 1);
  assert.equal(C.workoutStats(s.sessions[0]).sets, 2);
  assert.equal(C.workoutStats(s.sessions[0]).volume, 1160);
});
test("备份往返保留训练、计划和收藏，损坏文件不能作为有效数据恢复", () => {
  const s = C.initialState();
  s.favorites = ["bench"];
  s.plans = [{ id: "p1", name: "推训练", exerciseIds: ["bench"] }];
  const restored = C.importBackup(C.exportBackup(s));
  assert.deepEqual(restored, s);
  for (const invalid of [
    "{}",
    "null",
    "not json",
    JSON.stringify({
      format: "jilian-backup",
      version: 1,
      data: { ...s, sessions: [{ id: "bad" }] },
    }),
  ])
    assert.throws(() => C.importBackup(invalid));
  assert.throws(() =>
    C.restore(
      JSON.stringify({
        ...s,
        active: {
          id: "w",
          title: "坏数据",
          date: "2026-02-31",
          startedAt: 1,
          endedAt: null,
          notes: "",
          exercises: [],
        },
      }),
    ),
  );
});
test("计划只启动一份训练，放弃计划不改变历史，数据错误不会覆盖原状态", () => {
  const s = C.initialState();
  s.plans = [{ id: "p1", name: "推训练", exerciseIds: ["bench"] }];
  const next = C.startPlan(s, s.plans[0], catalog);
  assert.equal(next.active.exercises.length, 1);
  assert.equal(s.active, null);
  assert.throws(() => C.startWorkout(next, {}, catalog));
  const e = next.active.exercises[0];
  assert.throws(() => C.updateSet(next, e.id, e.sets[0].id, { weight: -5 }));
  assert.equal(next.active.exercises[0].sets[0].weight, 0);
  assert.throws(() => C.finishWorkout(next));
});
