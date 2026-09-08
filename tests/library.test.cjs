const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../app/src/main/assets/core.js");
const common = [
  {
    id: "bench",
    name: "卧推",
    category: "胸",
    equipment: "杠铃",
    parts: ["胸"],
    mode: "weight",
  },
];
const legacy = [
  {
    id: "rare",
    name: "泽奇深蹲",
    category: "腿",
    equipment: "杠铃",
    parts: ["腿"],
    mode: "weight",
  },
  {
    id: "unused",
    name: "颈部侧屈",
    category: "颈部",
    equipment: "其他",
    parts: ["颈部"],
    mode: "weight",
  },
];

test("精简库不展示冷门动作，旧模版、收藏和历史仍能继续使用原动作", () => {
  let state = C.initialState();
  assert.deepEqual(
    C.exerciseCatalog(state, common, legacy).library.map((e) => e.id),
    ["bench"],
  );
  assert.equal(C.exerciseCatalog(state, common, legacy).legacy.length, 0);
  state.plans.push({ id: "p", name: "旧腿训练", exerciseIds: ["rare"] });
  state.favorites.push("rare");
  let catalog = C.exerciseCatalog(state, common, legacy);
  assert.deepEqual(
    catalog.legacy.map((e) => e.id),
    ["rare"],
  );
  state = C.startPlan(state, state.plans[0], catalog.all);
  const e = state.active.exercises[0];
  state = C.updateSet(state, e.id, e.sets[0].id, {
    weight: 30,
    reps: 8,
    done: true,
  });
  state = C.finishWorkout(state);
  state.plans = [];
  state.favorites = [];
  state = C.importBackup(C.exportBackup(state));
  catalog = C.exerciseCatalog(state, common, legacy);
  assert.equal(catalog.library.length, 1);
  assert.deepEqual(
    catalog.legacy.map((e) => e.id),
    ["rare"],
  );
  assert.equal(state.sessions[0].exercises[0].name, "泽奇深蹲");
  assert.equal(C.workoutStats(state.sessions[0]).volume, 240);
});

test("自定义动作可编辑、移出及恢复，备份和旧模版保留，历史不会随改名改变", () => {
  let state = C.saveCustomExercise(
    C.initialState(),
    {
      name: "  我的推胸  ",
      category: "胸",
      equipment: "器械",
      mode: "weight",
      notes: "座椅第 3 格",
    },
    common,
  );
  const id = state.customExercises[0].id;
  assert.equal(state.customExercises[0].name, "我的推胸");
  assert.throws(
    () =>
      C.saveCustomExercise(
        state,
        { name: "我的推胸", category: "胸", equipment: "器械", mode: "weight" },
        common,
      ),
    /同名/,
  );
  state.plans.push({ id: "custom-plan", name: "我的模版", exerciseIds: [id] });
  state.favorites.push(id);
  state = C.startPlan(
    state,
    state.plans[0],
    C.exerciseCatalog(state, common, legacy).all,
  );
  const e = state.active.exercises[0];
  state = C.updateSet(state, e.id, e.sets[0].id, {
    weight: 40,
    reps: 10,
    done: true,
  });
  state = C.finishWorkout(state);
  const originalHistory = C.clone(state.sessions);
  assert.throws(
    () =>
      C.saveCustomExercise(
        state,
        { ...state.customExercises[0], mode: "time" },
        common,
      ),
    /记录方式/,
  );
  state = C.saveCustomExercise(
    state,
    { ...state.customExercises[0], name: "坐姿单臂推胸", notes: "左右各一组" },
    common,
  );
  assert.deepEqual(state.sessions, originalHistory);
  state = C.archiveCustomExercise(state, id);
  assert.equal(C.exerciseCatalog(state, common, legacy).library.length, 1);
  assert.deepEqual(state.favorites, []);
  assert.deepEqual(state.plans[0].exerciseIds, [id]);
  state = C.importBackup(C.exportBackup(state));
  assert.equal(state.customExercises[0].notes, "左右各一组");
  assert.equal(state.customExercises[0].archived, true);
  assert.deepEqual(state.sessions, originalHistory);
  const resumed = C.startPlan(
    state,
    state.plans[0],
    C.exerciseCatalog(state, common, legacy).all,
  );
  assert.equal(resumed.active.exercises[0].sets[0].weight, 40);
  assert.equal(resumed.active.exercises[0].name, "坐姿单臂推胸");
  state = C.archiveCustomExercise(state, id, false);
  assert.equal(C.exerciseCatalog(state, common, legacy).library.length, 2);
});

test("次数和计时记录不产生重量容量，旧动作改为计时后不沿用重量组", () => {
  const old = [{ ...common[0], id: "side-plank", name: "侧平板支撑" }];
  let state = C.addExercise(
    C.startWorkout(C.initialState()),
    "side-plank",
    old,
  );
  const e = state.active.exercises[0];
  state = C.updateSet(state, e.id, e.sets[0].id, {
    weight: 20,
    reps: 12,
    done: true,
  });
  const reps = C.clone(state.active);
  reps.exercises[0].mode = "reps";
  assert.equal(C.workoutStats(reps).volume, 0);
  reps.exercises[0].mode = "time";
  assert.equal(C.workoutStats(reps).volume, 0);
  state = C.finishWorkout(state);
  state = C.addExercise(C.startWorkout(state), "side-plank", [
    { ...old[0], mode: "time" },
  ]);
  assert.equal(state.active.exercises[0].sets[0].seconds, 60);
  assert.equal(state.active.exercises[0].sets[0].weight, 0);
  assert.equal(C.workoutStats(state.sessions[0]).volume, 240);
});

test("恢复同名的已删除动作前提示改名，不能产生两个同名自定义动作", () => {
  const draft = {
    name: "我的训练",
    category: "腿",
    equipment: "自重",
    mode: "reps",
  };
  let state = C.saveCustomExercise(C.initialState(), draft);
  const id = state.customExercises[0].id;
  state = C.archiveCustomExercise(state, id);
  state = C.saveCustomExercise(state, draft);
  assert.throws(() => C.archiveCustomExercise(state, id, false), /同名/);
  assert.equal(state.customExercises[0].archived, true);
  state = C.saveCustomExercise(state, {
    ...state.customExercises[0],
    name: "我的旧训练",
  });
  state = C.archiveCustomExercise(state, id, false);
  assert.equal(state.customExercises.filter((e) => !e.archived).length, 2);
});
