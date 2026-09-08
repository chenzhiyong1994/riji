(function (root, factory) {
  const api = factory();
  if (typeof module === "object") module.exports = api;
  else root.TrainCore = api;
})(this, function () {
  "use strict";
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const uid = () =>
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  const dateKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  function initialState() {
    return {
      schemaVersion: 1,
      sessions: [],
      plans: [],
      customExercises: [],
      bodyLogs: [],
      favorites: [],
      active: null,
      settings: { theme: "dark", restSeconds: 90, weekGoal: 3 },
      timer: null,
    };
  }
  function initialSet(mode = "weight") {
    return {
      id: uid(),
      weight: 0,
      reps: mode === "time" ? 0 : 10,
      seconds: mode === "time" ? 60 : 0,
      done: false,
      type: "normal",
    };
  }
  function exerciseCatalog(state, common, retired = []) {
    const referenced = new Set([
      ...state.favorites,
      ...state.plans.flatMap((p) => p.exerciseIds),
      ...[...state.sessions, state.active]
        .filter(Boolean)
        .flatMap((w) => w.exercises.map((e) => e.exerciseId)),
    ]);
    return {
      library: [...common, ...state.customExercises.filter((e) => !e.archived)],
      legacy: retired.filter((e) => referenced.has(e.id)),
      all: [...common, ...retired, ...state.customExercises],
    };
  }
  function customExerciseInUse(state, id) {
    return [...state.sessions, state.active]
      .filter(Boolean)
      .some((w) => w.exercises.some((e) => e.exerciseId === id));
  }
  function saveCustomExercise(state, input, common = []) {
    const s = clone(state),
      existing = input.id
        ? s.customExercises.find((e) => e.id === input.id)
        : null;
    if (input.id && !existing) throw Error("自定义动作不存在");
    const name = String(input.name || "").trim();
    const category = String(input.category || "").trim(),
      equipment = String(input.equipment || "").trim();
    const notes = String(input.notes || "").trim();
    if (!name || name.length > 60) throw Error("动作名称须为 1–60 个字符");
    if (
      !category ||
      category.length > 40 ||
      !equipment ||
      equipment.length > 40
    )
      throw Error("请选择有效的部位和器械");
    if (!["weight", "reps", "time"].includes(input.mode))
      throw Error("请选择记录方式");
    if (notes.length > 2000) throw Error("动作说明不能超过 2000 个字符");
    if (
      [...common, ...s.customExercises].some(
        (e) =>
          e.id !== input.id &&
          !e.archived &&
          e.name.trim().toLowerCase() === name.toLowerCase(),
      )
    )
      throw Error("已有同名动作，请换个名称或直接使用已有动作");
    if (
      existing &&
      existing.mode !== input.mode &&
      customExerciseInUse(s, existing.id)
    )
      throw Error("已有训练记录的动作不能更改记录方式，请另建一个动作");
    const value = {
      id: existing?.id || "custom-" + uid(),
      name,
      category,
      equipment,
      parts: [category],
      mode: input.mode,
      notes,
      archived: existing?.archived || false,
    };
    if (existing) Object.assign(existing, value);
    else {
      if (s.customExercises.length >= 1000)
        throw Error("自定义动作已达到 1000 项上限");
      s.customExercises.push(value);
    }
    return s;
  }
  function archiveCustomExercise(state, id, archived = true) {
    const s = clone(state),
      e = s.customExercises.find((e) => e.id === id);
    if (!e) throw Error("自定义动作不存在");
    if (
      !archived &&
      s.customExercises.some(
        (other) =>
          other.id !== id &&
          !other.archived &&
          other.name.trim().toLowerCase() === e.name.trim().toLowerCase(),
      )
    )
      throw Error("已有同名动作，请先编辑名称再恢复");
    e.archived = archived;
    if (archived) s.favorites = s.favorites.filter((x) => x !== id);
    return s;
  }
  function startWorkout(
    state,
    { title = "自由训练", date = dateKey() } = {},
    catalog = [],
  ) {
    if (state.active) throw Error("已有进行中的训练，请先完成或放弃");
    const s = clone(state);
    s.active = {
      id: uid(),
      title: String(title).trim() || "自由训练",
      date,
      startedAt: Date.now(),
      endedAt: null,
      notes: "",
      exercises: [],
    };
    return s;
  }
  function addExercise(state, id, catalog) {
    if (!state.active) throw Error("请先开始训练");
    const s = clone(state),
      e = [...catalog, ...s.customExercises].find((x) => x.id === id);
    if (!e) throw Error("动作不存在");
    const prior = s.sessions
      .flatMap((x) => x.exercises)
      .find((x) => x.exerciseId === id && x.mode === (e.mode || "weight"));
    const sets = prior
      ? prior.sets.map((x) => ({ ...x, id: uid(), done: false }))
      : Array.from({ length: 3 }, () => initialSet(e.mode));
    s.active.exercises.push({
      id: uid(),
      exerciseId: e.id,
      name: e.name,
      category: e.category,
      mode: e.mode || "weight",
      sets,
    });
    return s;
  }
  function updateSet(state, exerciseId, setId, patch) {
    const s = clone(state),
      e = s.active?.exercises.find((x) => x.id === exerciseId),
      set = e?.sets.find((x) => x.id === setId);
    if (!set) throw Error("训练组不存在");
    for (const key of ["weight", "reps", "seconds"])
      if (key in patch) {
        let value = Number(patch[key]);
        if (!Number.isFinite(value) || value < 0 || value > 100000)
          throw Error("请输入有效的非负数字");
        if (key !== "weight" && !Number.isInteger(value))
          throw Error("次数和时间须为整数");
        set[key] = value;
      }
    if ("done" in patch) set.done = !!patch.done;
    if (["normal", "warmup", "drop"].includes(patch.type))
      set.type = patch.type;
    return s;
  }
  function workoutStats(workout) {
    let volume = 0,
      sets = 0,
      reps = 0,
      seconds = 0;
    for (const e of workout?.exercises || [])
      for (const s of e.sets || [])
        if (s.done) {
          sets++;
          reps += s.reps;
          seconds += s.seconds;
          if (e.mode === "weight") volume += s.weight * s.reps;
        }
    return {
      volume: Math.round(volume * 100) / 100,
      sets,
      reps,
      seconds,
      duration: workout
        ? Math.max(
            0,
            Math.round(
              ((workout.endedAt || Date.now()) - workout.startedAt) / 1000,
            ),
          )
        : 0,
    };
  }
  function finishWorkout(state) {
    if (!state.active || workoutStats(state.active).sets === 0)
      throw Error("至少完成一组后才能保存训练");
    const s = clone(state),
      w = s.active;
    w.endedAt = Date.now();
    w.exercises = w.exercises
      .map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) }))
      .filter((e) => e.sets.length);
    s.sessions.unshift(w);
    s.active = null;
    s.timer = null;
    return s;
  }
  function validDate(value) {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !isNaN(Date.parse(value)) &&
      new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
    );
  }
  function startPlan(state, plan, catalog, date = dateKey()) {
    let s = startWorkout(state, { title: plan.name, date }, catalog);
    for (const id of plan.exerciseIds) s = addExercise(s, id, catalog);
    return s;
  }
  function restore(text) {
    const v = JSON.parse(text),
      bad = () => {
        throw Error("备份内容损坏或格式不受支持，原有数据未改变");
      };
    const str = (x, max = 200) => {
      if (typeof x !== "string" || x.length > max) bad();
      return x;
    };
    const num = (x, max = 100000) => {
      if (typeof x !== "number" || !Number.isFinite(x) || x < 0 || x > max)
        bad();
      return x;
    };
    const arr = (x, max = 10000) => {
      if (!Array.isArray(x) || x.length > max) bad();
      return x;
    };
    const mode = (x) => {
      if (!["weight", "time", "reps"].includes(x)) bad();
      return x;
    };
    const day = (x) => {
      if (!validDate(x)) bad();
      return x;
    };
    function workout(w) {
      if (!w || typeof w !== "object") bad();
      const startedAt = num(w.startedAt, Number.MAX_SAFE_INTEGER),
        endedAt =
          w.endedAt === null ? null : num(w.endedAt, Number.MAX_SAFE_INTEGER);
      if (endedAt !== null && endedAt < startedAt) bad();
      return {
        id: str(w.id),
        title: str(w.title),
        date: day(w.date),
        startedAt,
        endedAt,
        notes: str(w.notes || "", 5000),
        exercises: arr(w.exercises, 200).map((e) => ({
          id: str(e.id),
          exerciseId: str(e.exerciseId),
          name: str(e.name),
          category: str(e.category),
          mode: mode(e.mode),
          sets: arr(e.sets, 200).map((t) => {
            if (
              typeof t.done !== "boolean" ||
              !["normal", "warmup", "drop"].includes(t.type) ||
              !Number.isInteger(t.reps) ||
              !Number.isInteger(t.seconds)
            )
              bad();
            return {
              id: str(t.id),
              weight: num(t.weight),
              reps: num(t.reps),
              seconds: num(t.seconds),
              done: t.done,
              type: t.type,
            };
          }),
        })),
      };
    }
    if (!v || v.schemaVersion !== 1) bad();
    const s = initialState();
    s.sessions = arr(v.sessions).map(workout);
    if (s.sessions.some((w) => w.endedAt === null)) bad();
    s.active = v.active === null ? null : workout(v.active);
    if (s.active && s.active.endedAt !== null) bad();
    s.plans = arr(v.plans, 500).map((p) => ({
      id: str(p.id),
      name: str(p.name),
      exerciseIds: arr(p.exerciseIds, 200).map((x) => str(x)),
    }));
    s.customExercises = arr(v.customExercises, 1000).map((e) => {
      if (e.archived !== undefined && typeof e.archived !== "boolean") bad();
      return {
        id: str(e.id),
        name: str(e.name),
        category: str(e.category),
        equipment: str(e.equipment),
        parts: arr(e.parts, 20).map((x) => str(x)),
        mode: mode(e.mode),
        notes: str(e.notes || "", 2000),
        archived: e.archived || false,
      };
    });
    s.favorites = arr(v.favorites, 5000).map((x) => str(x));
    s.bodyLogs = arr(v.bodyLogs).map((e) => ({
      id: str(e.id),
      date: day(e.date),
      weight: num(e.weight, 600),
      waist: num(e.waist, 400),
    }));
    if (!v.settings || !["dark", "light"].includes(v.settings.theme)) bad();
    s.settings = {
      theme: v.settings.theme,
      restSeconds: num(v.settings.restSeconds, 3600),
      weekGoal: num(v.settings.weekGoal, 7),
    };
    if (v.timer !== null) {
      if (!v.timer) bad();
      s.timer = {
        endsAt: num(v.timer.endsAt, Number.MAX_SAFE_INTEGER),
        duration: num(v.timer.duration, 3600),
      };
    }
    for (const items of [s.sessions, s.plans, s.customExercises])
      if (new Set(items.map((x) => x.id)).size !== items.length) bad();
    return s;
  }
  function exportBackup(state) {
    return JSON.stringify(
      {
        format: "jilian-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        data: state,
      },
      null,
      2,
    );
  }
  function importBackup(text) {
    if (text.length > 16 * 1024 * 1024) throw Error("备份文件超过 16 MB");
    const v = JSON.parse(text);
    if (v?.format !== "jilian-backup" || v.version !== 1)
      throw Error("请选择日跻或旧版迹练导出的 JSON 备份");
    return restore(JSON.stringify(v.data));
  }
  return {
    clone,
    uid,
    dateKey,
    validDate,
    initialState,
    initialSet,
    exerciseCatalog,
    customExerciseInUse,
    saveCustomExercise,
    archiveCustomExercise,
    startWorkout,
    startPlan,
    addExercise,
    updateSet,
    workoutStats,
    finishWorkout,
    restore,
    exportBackup,
    importBackup,
  };
});
