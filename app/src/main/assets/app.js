(function () {
  "use strict";
  const C = window.TrainCore;
  const builtin = [...new Map(window.MOVEMENTS.map((e) => [e.id, e])).values()];
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const num = (n) =>
    new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 1 }).format(n || 0);
  const paths = {
    plus: "M12 5v14M5 12h14",
    check: "m5 12 4 4L19 6",
    chevron: "m9 5 7 7-7 7",
    back: "m15 5-7 7 7 7",
    close: "m6 6 12 12M6 18 18 6",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    dumbbell: "M5 5v14M2 8v8M19 5v14M22 8v8M5 10h14M5 14h14",
    calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h2M14 14h2M8 17h2",
    chart: "M4 3v18h17M8 16v-5M13 16V7M18 16V4",
    book: "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3zM12 6v16",
    person: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21v-3a8 8 0 0 1 16 0v3",
    clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
    star: "m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z",
    download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
    upload: "M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5",
    moon: "M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12",
    sun: "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1",
    shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zM8 12l3 3 5-6",
    edit: "m15 3 6 6-12 12H3v-6zM13 5l6 6",
    trash: "M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    copy: "M8 8h13v13H8zM4 16H2V2h14v2",
    arrow: "M4 12h16m-6-6 6 6-6 6",
    scale: "M3 5h18v16H3zM7 9a6 6 0 0 1 10 0M12 7v4",
    note: "M4 3h16v18H4zM8 8h8M8 12h8M8 16h5",
    target:
      "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0M12 10v4M10 12h4",
  };
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.dumbbell}"/></svg>`;
  const btn = (a, label, cls = "primary", extra = "") =>
    `<button type="button" class="${cls}" data-action="${a}" ${extra}>${label}</button>`;
  const ib = (a, name, label, extra = "") =>
    btn(a, icon(name), "icon-btn", `aria-label="${esc(label)}" ${extra}`);
  const native = () => !!window.NativeStore;
  let data = C.initialState(),
    storageBroken = false,
    rawStored = "";
  try {
    rawStored = native()
      ? NativeStore.load()
      : localStorage.getItem("jilian-state") || "";
    if (rawStored) data = C.restore(rawStored);
  } catch (e) {
    storageBroken = true;
  }
  let tab = "training",
    selectedDay = C.dateKey(),
    historyMonth = selectedDay.slice(0, 7),
    historyDay = "",
    category = "胸",
    search = "",
    equipment = "全部",
    favoritesOnly = false,
    limit = 45,
    modal = null,
    planDraft = null,
    toastHandle;
  let saveError = "";
  const retired = window.LEGACY_MOVEMENTS || [];
  let catalogData, catalogCache;
  function catalogView() {
    if (catalogData !== data) {
      catalogData = data;
      catalogCache = C.exerciseCatalog(data, builtin, retired);
      catalogCache.byId = new Map(catalogCache.all.map((e) => [e.id, e]));
    }
    return catalogCache;
  }
  const catalog = () => catalogView().all;
  const movement = (id) => catalogView().byId.get(id);
  // Reuse the plank visual without changing the legacy ID or recording mode.
  const animationFor = (e) =>
    window.EXERCISE_ANIMATIONS?.[
      e?.id === "plan-king" ? "plank_recorder" : e?.id
    ];
  const customMovement = (id) => data.customExercises.find((e) => e.id === id);
  const categoryOptions = () => [
    "全部",
    ...new Set(builtin.map((e) => e.category)),
    "自定义",
    ...(data.customExercises.some((e) => e.archived) ? ["已删除"] : []),
    ...(catalogView().legacy.length ? ["已用旧动作"] : []),
  ];
  function persist(next) {
    if (storageBroken)
      throw Error("本地数据读取失败，请先导出原始文件，避免覆盖");
    const serialized = JSON.stringify(next);
    if (native()) {
      if (!NativeStore.save(serialized))
        throw Error("保存失败，请检查设备存储空间");
    } else localStorage.setItem("jilian-state", serialized);
    data = next;
    saveError = "";
  }
  function mutate(fn) {
    const next = C.clone(data);
    fn(next);
    persist(next);
  }
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    clearTimeout(toastHandle);
    toastHandle = setTimeout(() => $("#toast").classList.remove("show"), 3300);
  }
  function safe(fn) {
    try {
      return fn();
    } catch (e) {
      toast(e.message || "操作未完成");
      return null;
    }
  }
  function duration(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }
  const setMetric = (w) => {
    const s = C.workoutStats(w);
    return `<div class="summary"><div class="metric"><strong>${num(s.volume)}<i>kg</i></strong><label>训练容量</label></div><div class="metric"><strong>${s.sets}<i>组</i></strong><label>已完成</label></div><div class="metric"><strong>${Math.floor(s.duration / 60)}<i>分钟</i></strong><label>训练时长</label></div></div>`;
  };
  function thumb(e, detail = false) {
    const motion = animationFor(e);
    if (motion) {
      if (!detail)
        return `<img class="thumb" src="${esc(motion.thumb)}" alt="${esc(e.name)}" loading="lazy">`;
      const playing =
        !modal.paused &&
        !document.hidden &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      modal.paused = !playing;
      return `<div class="motion-player"><img class="detail-image motion-image" src="${esc(playing ? motion.animation : motion.poster)}" alt="${esc(e.name)}动作动画"><div class="motion-controls">${btn("toggleMotion", playing ? "暂停动画" : "播放动画", "secondary", `aria-pressed="${playing}"`)}<span class="hint motion-state">${playing ? "3 秒循环 · 红色肌群高亮" : "已暂停 · 静态封面"}</span></div></div>`;
    }
    return detail
      ? `<div class="media-empty">${icon("dumbbell")}<strong>暂无动作图片</strong><span>可以正常添加动作并记录训练</span></div>`
      : `<div class="thumb thumb-placeholder">${icon("dumbbell")}</div>`;
  }
  function setMotionPlaying(playing) {
    if (modal?.type !== "detail") return;
    const motion = animationFor(movement(modal.id)),
      image = $(".motion-image");
    if (!motion || !image) return;
    modal.paused = !playing;
    image.src = playing ? motion.animation : motion.poster;
    const button = $('[data-action="toggleMotion"]');
    button.textContent = playing ? "暂停动画" : "播放动画";
    button.setAttribute("aria-pressed", String(playing));
    $(".motion-state").textContent = playing
      ? "3 秒循环 · 红色肌群高亮"
      : "已暂停 · 静态封面";
  }
  function top(title, sub, buttons = "") {
    return `<header class="topbar"><div><div class="eyebrow">${sub}</div><h1>${title}</h1></div><div class="actions">${buttons}</div></header>`;
  }
  function empty(title, description, which = "dumbbell") {
    return `<div class="empty">${icon(which)}<h3>${title}</h3><p>${description}</p></div>`;
  }
  function nav() {
    return `<nav class="bottom-nav" aria-label="主要导航">${[
      ["training", "dumbbell", "训练"],
      ["movements", "book", "动作"],
      ["history", "calendar", "历史"],
      ["me", "person", "我的"],
    ]
      .map(([id, i, t]) =>
        btn(
          "tab",
          icon(i) + `<span>${t}</span>`,
          "nav-item " + (tab === id ? "active" : ""),
          `data-tab="${id}" aria-label="${t}"`,
        ),
      )
      .join("")}</nav>`;
  }
  function render() {
    document.body.classList.toggle("light", data.settings.theme === "light");
    if (native()) NativeStore.setTheme(data.settings.theme === "light");
    $("#app").innerHTML =
      `<main class="page ${data.timer ? "with-timer" : ""}">${{ training: trainingPage, movements: movementsPage, history: historyPage, me: mePage }[tab]()}</main>${nav()}<div id="rest-slot"></div>`;
    renderTimer();
    if (storageBroken && !modal) openModal("storageError");
  }
  function weekStrip() {
    const base = new Date(selectedDay + "T12:00:00"),
      monday = new Date(base);
    monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      const key = C.dateKey(d),
        has = data.sessions.some((w) => w.date === key);
      return btn(
        "day",
        `<span>${["一", "二", "三", "四", "五", "六", "日"][i]}</span><strong>${d.getDate()}</strong><span class="dot ${has ? "trained" : ""}"></span>`,
        "day " + (key === selectedDay ? "selected" : ""),
        `data-date="${key}" aria-label="${key}"`,
      );
    }).join("")}</div>`;
  }
  const presets = () =>
    [
      {
        id: "preset-push",
        name: "推 · 胸肩三头",
        exerciseIds: [
          "benchpress",
          "incline-benchpress",
          "shoulderpress",
          "vbar_pulldown",
        ],
      },
      {
        id: "preset-pull",
        name: "拉 · 背部二头",
        exerciseIds: pickNames(["高位下拉", "坐姿划船", "哑铃弯举"]),
      },
      {
        id: "preset-leg",
        name: "腿 · 下肢训练",
        exerciseIds: pickNames(["杠铃深蹲", "罗马尼亚硬拉", "坐姿腿屈伸"]),
      },
    ].map((p) => ({
      ...p,
      exerciseIds: p.exerciseIds.filter((id) => movement(id)),
    }));
  function pickNames(names) {
    return names
      .map(
        (name) =>
          builtin.find((e) => e.name === name)?.id ||
          builtin.find((e) => e.name.includes(name))?.id,
      )
      .filter(Boolean);
  }
  function planCard(p, i) {
    return btn(
      "plan",
      `<div class="plan-mark">${String(i + 1).padStart(2, "0")} / TRAINING</div><span class="arrow">${icon("arrow")}</span><h3>${esc(p.name)}</h3><p>${p.exerciseIds.length} 个动作 · 可自由调整</p>`,
      "plan",
      `data-id="${esc(p.id)}"`,
    );
  }
  function trainingPage() {
    const daySessions = data.sessions.filter((w) => w.date === selectedDay);
    let html = top(
      "训练",
      "日跻 / TRAINING",
      ib("timerSettings", "clock", "休息计时器") +
        ib("newWorkout", "plus", "新建训练"),
    );
    html += weekStrip();
    if (data.active) {
      const w = data.active;
      html += `<div class="between workout-top"><div><div class="live-pill"><span id="active-duration">${duration(C.workoutStats(w).duration)}</span> 训练进行中</div><h2 style="margin-top:7px">${esc(w.title)}</h2><small>${w.date}</small></div>${btn("finish", "完成训练", "primary")}</div>${setMetric(w)}`;
      html +=
        w.exercises.map(exerciseCard).join("") ||
        empty("添加第一个动作", "从动作库中选择，开始记录今天的训练");
      html += btn("addMovements", icon("plus") + " 添加动作", "secondary wide");
      html += `<label class="sheet-field workout-note"><span>训练备注</span><textarea id="workout-notes" maxlength="5000" placeholder="记录今天的状态、感受和进步…">${esc(w.notes)}</textarea></label><div class="between section">${btn("saveAsPlan", "存为训练模版", "text-btn")}${btn("discard", "放弃本次训练", "text-btn", `style="color:var(--muted)"`)}</div>`;
    } else {
      html += `<div class="between section" style="margin-top:0"><h2>${selectedDay === C.dateKey() ? "今日训练" : selectedDay.slice(5).replace("-", " / ") + " 的训练"}</h2><span class="tag green">${daySessions.length ? "已完成 " + daySessions.length + " 次" : "准备就绪"}</span></div>`;
      html += daySessions.length
        ? daySessions.map(historyCard).join("")
        : `<div class="hero"><div class="hero-art">${icon("dumbbell")}</div><span class="tag green">记录你的每一次进步</span><h2>今天，<br>练得怎么样？</h2><p>从一个动作、一组训练开始。</p>${btn("newWorkout", icon("plus") + " 新建训练", "primary wide start")}</div>`;
      if (daySessions.length)
        html += btn(
          "newWorkout",
          icon("plus") + " 再练一次",
          "primary wide start",
        );
    }
    html += `<div class="between section"><h2>个人模版</h2>${btn("newPlan", icon("plus") + " 新建", "text-btn")}</div>`;
    html += data.plans.length
      ? `<div class="template-grid">${data.plans.map(planCard).join("")}</div>`
      : `<p class="hint">把常练的动作存成模版，下次直接开始。</p>`;
    html += `<div class="between section"><h2>快速开始</h2><small>基础动作组合</small></div><div class="template-grid">${presets().map(planCard).join("")}</div><p class="hint">组合可按自己的习惯修改，重量由你填写。</p>`;
    return html;
  }
  function exerciseCard(e) {
    const original = movement(e.exerciseId),
      prior = data.sessions
        .flatMap((w) => w.exercises)
        .find((x) => x.exerciseId === e.exerciseId && x.mode === e.mode);
    return `<article class="exercise-card"><div class="row exercise-head">${thumb(original)}<button class="grow" style="text-align:left" data-action="detail" data-id="${esc(e.exerciseId)}"><h3>${esc(e.name)}</h3><small>${esc(e.category)} · ${e.mode === "time" ? "计时记录" : e.mode === "reps" ? "次数记录" : "力量训练"}</small></button>${ib("exerciseMenu", "more", "动作选项", `data-id="${esc(e.id)}"`)}</div><div class="set-row labels"><span>组</span><span>上次</span><span>${e.mode === "time" ? "秒" : e.mode === "reps" ? "方式" : "重量 kg"}</span><span>${e.mode === "time" ? "次数（可选）" : "次数"}</span><span>完成</span><span></span></div>${e.sets.map((s, i) => `<div class="set-row ${s.done ? "done" : ""}"><button data-action="setType" data-e="${esc(e.id)}" data-s="${esc(s.id)}" class="set-type ${s.type === "normal" ? "" : "special"}" aria-label="第 ${i + 1} 组类型">${s.type === "warmup" ? "W" : s.type === "drop" ? "D" : i + 1}</button><span class="previous">${prior?.sets[i] ? esc(e.mode === "time" ? prior.sets[i].seconds + "秒" : e.mode === "reps" ? prior.sets[i].reps + "次" : prior.sets[i].weight + "×" + prior.sets[i].reps) : "—"}</span>${e.mode === "reps" ? '<span class="reps-only">计次</span>' : `<input type="number" min="0" max="100000" step="${e.mode === "time" ? "1" : "0.5"}" inputmode="decimal" data-e="${esc(e.id)}" data-s="${esc(s.id)}" data-field="${e.mode === "time" ? "seconds" : "weight"}" value="${e.mode === "time" ? s.seconds : s.weight}" aria-label="${esc(e.name)} 第${i + 1}组${e.mode === "time" ? "秒数" : "重量"}">`}<input type="number" min="0" max="100000" step="1" inputmode="numeric" data-e="${esc(e.id)}" data-s="${esc(s.id)}" data-field="reps" value="${s.reps}" aria-label="${esc(e.name)} 第${i + 1}组次数"><button class="check ${s.done ? "done" : ""}" data-action="toggleSet" data-e="${esc(e.id)}" data-s="${esc(s.id)}" aria-label="${s.done ? "取消" : "完成"}第${i + 1}组" aria-pressed="${s.done}">${icon("check")}</button><button class="remove-set" data-action="removeSet" data-e="${esc(e.id)}" data-s="${esc(s.id)}" aria-label="删除第${i + 1}组">−</button></div>`).join("")}${btn("addSet", "＋ 添加一组", "add-set", `data-id="${esc(e.id)}"`)}</article>`;
  }
  function movementsPage() {
    return (
      top(
        "动作",
        "MOVEMENT LIBRARY",
        btn(
          "customExercise",
          icon("plus") + " 自定义动作",
          "secondary custom-create",
        ),
      ) +
      `<div class="library-summary"><strong>${builtin.length} 个常用动作</strong><span>自定义 ${data.customExercises.filter((e) => !e.archived).length} 个</span></div><div class="search">${icon("search")}<input id="movement-search" placeholder="搜索动作，如：卧推、划船" value="${esc(search)}" aria-label="搜索动作"></div><div class="chips">${["全部", "杠铃", "哑铃", "器械", "绳索", "自重", "其他"].map((x) => btn("equipment", x, "chip " + (equipment === x ? "active" : ""), `data-value="${x}"`)).join("")}${btn("favorites", "★ 收藏", "chip " + (favoritesOnly ? "active" : ""))}</div><div class="catalog-layout"><aside class="categories">${categoryOptions()
        .map((x) =>
          btn(
            "category",
            x,
            "cat " + (category === x ? "active" : ""),
            `data-value="${x}"`,
          ),
        )
        .join(
          "",
        )}</aside><section class="movement-list" id="movement-results">${movementResults()}</section></div>`
    );
  }
  function filteredCatalog(
    cat = category,
    q = search,
    eq = equipment,
    fav = favoritesOnly,
  ) {
    const source = fav
      ? catalog()
      : cat === "已删除"
        ? data.customExercises.filter((e) => e.archived)
        : cat === "已用旧动作"
          ? catalogView().legacy
          : catalogView().library;
    return source.filter(
      (e) =>
        (cat === "全部" ||
          cat === "已用旧动作" ||
          cat === "已删除" ||
          (cat === "自定义" ? !!customMovement(e.id) : e.category === cat)) &&
        (eq === "全部" || e.equipment === eq) &&
        (!fav || data.favorites.includes(e.id)) &&
        (!q ||
          [e.name, e.category, e.equipment, ...e.parts]
            .join(" ")
            .toLowerCase()
            .includes(q.toLowerCase().trim())),
    );
  }
  function movementResults() {
    const entries = filteredCatalog();
    return (
      `<div class="filter-counter">${entries.length} 个动作 · ${entries.filter((e) => animationFor(e)).length} 项配图</div>` +
      entries
        .slice(0, limit)
        .map(
          (e) =>
            `<div class="move-row"><button data-action="detail" data-id="${esc(e.id)}" class="row grow" style="text-align:left">${thumb(e)}<div class="grow"><div class="move-name">${esc(e.name)}</div><div class="move-meta">${esc(e.equipment)} · ${esc(e.category)}</div></div></button><button class="mini-plus" data-action="quickAdd" data-id="${esc(e.id)}" aria-label="添加${esc(e.name)}">${icon("plus")}</button></div>`,
        )
        .join("") +
      (entries.length === 0
        ? empty("没有找到动作", "试试其他关键词，或创建自定义动作", "search") +
          btn("customExercise", "新建自定义动作", "secondary wide")
        : "") +
      (entries.length > limit
        ? btn(
            "loadMore",
            `加载更多（${limit}/${entries.length}）`,
            "text-btn wide",
          )
        : "")
    );
  }
  function calendar(month) {
    const [year, m] = month.split("-").map(Number),
      first = new Date(year, m - 1, 1),
      days = new Date(year, m, 0).getDate(),
      offset = (first.getDay() + 6) % 7;
    return `<div class="calendar">${["一", "二", "三", "四", "五", "六", "日"].map((x) => `<div class="weekday">${x}</div>`).join("")}${"<span></span>".repeat(offset)}${Array.from(
      { length: days },
      (_, i) => {
        const d = month + "-" + String(i + 1).padStart(2, "0"),
          trained = data.sessions.some((w) => w.date === d);
        return btn(
          "historyDay",
          i + 1,
          " " +
            (trained ? "trained " : "") +
            (historyDay === d ? "selected " : "") +
            (d === C.dateKey() ? "today" : ""),
          `data-date="${d}" aria-label="${d}${trained ? " 已训练" : ""}"`,
        );
      },
    ).join("")}</div>`;
  }
  function historyCard(w) {
    const stats = C.workoutStats(w);
    return `<button class="history-item" data-action="session" data-id="${esc(w.id)}"><div class="history-date"><strong>${w.date.slice(8)}</strong><small>${w.date.slice(5, 7)} 月</small></div><div class="grow"><h3>${esc(w.title)}</h3><p>${w.exercises.length} 个动作 · ${stats.sets} 组 · ${num(stats.volume)} kg</p><p style="margin-top:4px">${esc(
      w.exercises
        .map((e) => e.name)
        .slice(0, 3)
        .join(" / "),
    )}</p></div>${icon("chevron")}</button>`;
  }
  function historyPage() {
    let sessions = data.sessions.filter((w) => w.date.startsWith(historyMonth));
    const stats = sessions.map(C.workoutStats),
      volume = stats.reduce((n, x) => n + x.volume, 0),
      days = new Set(sessions.map((w) => w.date)).size;
    let html = top(
      "历史",
      "TRAINING HISTORY",
      ib("stats", "chart", "训练统计"),
    );
    html += `<div class="card"><div class="between">${ib("prevMonth", "back", "上个月")}<h2>${historyMonth.replace("-", " 年 ")} 月</h2>${ib("nextMonth", "chevron", "下个月")}</div>${calendar(historyMonth)}</div><div class="summary"><div class="metric"><strong>${days}<i>天</i></strong><label>本月训练</label></div><div class="metric"><strong>${num(volume)}<i>kg</i></strong><label>本月容量</label></div><div class="metric"><strong>${Math.round(stats.reduce((n, x) => n + x.duration, 0) / 60)}<i>分钟</i></strong><label>累计时长</label></div></div><div class="between section"><h2>${historyDay ? historyDay.slice(5) + " 的记录" : "本月记录"}</h2>${historyDay ? btn("clearHistoryDay", "显示全部", "text-btn") : `<small>${sessions.length} 次训练</small>`}</div>`;
    if (historyDay) sessions = sessions.filter((w) => w.date === historyDay);
    html += sessions.length
      ? sessions
          .slice()
          .sort(
            (a, b) => b.date.localeCompare(a.date) || b.startedAt - a.startedAt,
          )
          .map(historyCard)
          .join("")
      : empty(
          "还没有训练记录",
          "完成并保存一次训练后，就会出现在这里。",
          "calendar",
        );
    return html;
  }
  function setting(a, i, label, value = "") {
    return `<button class="setting-row" data-action="${a}">${icon(i)}<label>${label}</label><small>${value}</small>${icon("chevron", "chevron")}</button>`;
  }
  function mePage() {
    const stats = data.sessions.map(C.workoutStats),
      days = new Set(data.sessions.map((x) => x.date)).size;
    return (
      top("我的", "PERSONAL SPACE") +
      `<div class="record-grid"><div class="record"><strong>${days}<small> 天</small></strong><span>累计训练</span></div><div class="record"><strong>${num(stats.reduce((n, s) => n + s.volume, 0))}<small> kg</small></strong><span>累计训练容量</span></div></div><div class="settings-group">${setting("stats", "chart", "训练统计", "容量 / 部位 / PR")}${setting("body", "scale", "身体数据", "体重 / 腰围")}${setting("showFavorites", "star", "我的收藏", data.favorites.length + " 个动作")}${setting("allPlans", "book", "个人模版", data.plans.length + " 个")}</div><div class="settings-group">${setting("theme", data.settings.theme === "dark" ? "moon" : "sun", "外观", data.settings.theme === "dark" ? "深色" : "浅色")}${setting("timerSettings", "clock", "组间休息", data.settings.restSeconds + " 秒")}${setting("weekGoal", "target", "每周训练目标", data.settings.weekGoal + " 天")}</div><div class="settings-group">${setting("export", "download", "导出备份", "JSON 文件")}${setting("import", "upload", "导入备份", "从本机文件恢复")}${setting("about", "shield", "关于与数据", "离线使用")}</div><div class="version">1.0.6 · ${builtin.length} 个内置动作</div>`
    );
  }
  function renderTimer() {
    const slot = $("#rest-slot");
    if (!slot) return;
    if (!data.timer) {
      slot.innerHTML = "";
      return;
    }
    const left = Math.max(
      0,
      Math.ceil((data.timer.endsAt - Date.now()) / 1000),
    );
    slot.innerHTML = `<aside class="rest-bar">${icon("clock")}<div class="grow"><small>${left ? "组间休息" : "休息结束"}</small><div class="clock">${duration(left)}</div></div>${btn("timerPlus", "+30 秒", "", "")}${btn("timerStop", left ? "跳过" : "完成", "", "")}</aside>`;
  }
  function openModal(type, more = {}) {
    modal = { type, ...more };
    renderModal();
  }
  function closeModal() {
    if (modal?.type === "customExercise" && modal.returnTo) {
      modal = modal.returnTo;
      renderModal();
      return;
    }
    modal = null;
    $("#overlay").innerHTML = "";
  }
  function modalFrame(title, content, footer = "") {
    return `<div class="sheet-backdrop" data-action="backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="between sheet-header"><h2 class="sheet-title">${esc(title)}</h2>${ib("close", "close", "关闭")}</div>${content}${footer}</section></div>`;
  }
  function field(label, id, value = "", type = "text", extra = "") {
    return `<label class="sheet-field"><span>${label}</span><input id="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  }
  function selectField(label, id, options, value, extra = "") {
    return `<label class="sheet-field"><span>${label}</span><select id="${id}" ${extra}>${options
      .map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${esc(v)}" ${value === v ? "selected" : ""}>${esc(l)}</option>`;
      })
      .join("")}</select></label>`;
  }
  function renderModal() {
    if (!modal) {
      closeModal();
      return;
    }
    let title = "",
      content = "",
      footer = "";
    const m = modal;
    if (m.type === "newWorkout") {
      title = "新建训练";
      content =
        field("训练名称", "new-title", "自由训练", "text", 'maxlength="100"') +
        field("训练日期", "new-date", selectedDay, "date") +
        '<p class="hint">每次填写和勾选都会自动保存在本机。</p>';
      footer = btn("startWorkout", "开始记录", "primary wide start");
    } else if (m.type === "picker") {
      title = m.target === "plan" ? "选择模版动作" : "添加动作";
      content = `<div class="search">${icon("search")}<input id="picker-search" placeholder="搜索动作" value="${esc(m.query || "")}" aria-label="筛选动作"></div>${selectField("训练部位", "picker-category", categoryOptions(), m.category || "胸")}<div class="picker" id="picker-results" style="margin-top:18px">${pickerResults()}</div>`;
      footer =
        btn("customFromPicker", "＋ 新建自定义动作", "text-btn wide") +
        `<div class="sheet-actions">${btn("confirmPicker", `添加已选（${m.selected?.length || 0}）`, "primary wide", `id="confirm-picker"`)}</div>`;
    } else if (m.type === "detail") {
      const e = movement(m.id);
      if (!e) return closeModal();
      title = e.name;
      const records = data.sessions.filter((w) =>
          w.exercises.some((x) => x.exerciseId === e.id),
        ),
        best = Math.max(
          0,
          ...records.flatMap((w) =>
            w.exercises
              .filter((x) => x.exerciseId === e.id)
              .flatMap((x) =>
                x.sets
                  .filter((s) => s.done)
                  .map((s) =>
                    e.mode === "time"
                      ? s.seconds
                      : e.mode === "reps"
                        ? s.reps
                        : s.weight,
                  ),
              ),
          ),
        );
      content =
        thumb(e, true) +
        `<div class="detail-tags"><span class="tag green">${esc(e.category)}</span><span class="tag">${esc(e.equipment)}</span>${e.parts
          .slice(0, 4)
          .map((p) => `<span class="tag">${esc(p)}</span>`)
          .join(
            "",
          )}</div><div class="record-grid"><div class="record"><strong>${records.length}</strong><span>记录次数</span></div><div class="record"><strong>${num(best)}<small> ${e.mode === "time" ? "秒" : e.mode === "reps" ? "次" : "kg"}</small></strong><span>${e.mode === "time" ? "单组最长时间" : e.mode === "reps" ? "单组最多次数" : "历史最高重量"}</span></div></div>` +
        (animationFor(e)
          ? '<p class="hint media-credit">动作与肌群示意 · 待检查</p>'
          : `<p class="hint">${customMovement(e.id) ? "这是你的自定义动作。" : builtin.some((x) => x.id === e.id) ? "轻量版仅为部分常用动作配图。" : "此动作用于保留你的旧训练和模版。"}</p>`) +
        (e.notes
          ? `<div class="exercise-notes"><h3>动作说明</h3><p>${esc(e.notes)}</p></div>`
          : "") +
        (records.length
          ? `<div class="section"><h3>最近记录</h3></div>${records.slice(0, 3).map(historyCard).join("")}`
          : "");
      footer = `<div class="sheet-actions">${btn("favorite", icon("star") + (data.favorites.includes(e.id) ? "已收藏" : "收藏"), "secondary", `data-id="${esc(e.id)}"`)}${btn("quickAdd", "加入训练", "primary", `data-id="${esc(e.id)}"`)}</div>`;
      if (customMovement(e.id))
        footer += `<div class="sheet-actions custom-management">${btn("editCustom", "编辑动作", "text-btn", `data-id="${esc(e.id)}"`)}${e.archived ? btn("restoreCustom", "恢复到动作库", "text-btn", `data-id="${esc(e.id)}"`) : btn("deleteCustom", "删除动作", "danger-btn", `data-id="${esc(e.id)}"`)}</div>`;
    } else if (m.type === "plan") {
      const p = [...data.plans, ...presets()].find((x) => x.id === m.id);
      if (!p) return closeModal();
      title = p.name;
      content = `<p class="hint">${p.exerciseIds.length} 个动作 · 开始时带入上次记录的组数与重量</p>${p.exerciseIds
        .map((id) => {
          const e = movement(id);
          return e
            ? `<div class="move-row">${thumb(e)}<div class="grow"><h3>${esc(e.name)}</h3><small>${esc(e.category)} · ${esc(e.equipment)}</small></div></div>`
            : "";
        })
        .join("")}`;
      footer = `<div class="sheet-actions">${btn("editPlan", "编辑模版", "secondary", `data-id="${esc(p.id)}"`)}${btn("startPlan", "用模版开始", "primary", `data-id="${esc(p.id)}"`)}</div>`;
    } else if (m.type === "planEdit") {
      title = planDraft.isNew ? "新建模版" : "编辑模版";
      content =
        field(
          "模版名称",
          "plan-name",
          planDraft.name,
          "text",
          'maxlength="100"',
        ) +
        `<div class="between section"><h3>动作顺序</h3>${btn("planPicker", icon("plus") + " 选择动作", "text-btn")}</div>` +
        planDraft.exerciseIds
          .map((id, i) => {
            const e = movement(id);
            return `<div class="move-row">${thumb(e)}<div class="grow"><div class="move-name">${esc(e?.name || "未找到动作")}</div><small>第 ${i + 1} 个动作</small></div>${i ? btn("planUp", "↑", "mini-plus", `data-index="${i}" aria-label="上移动作"`) : ""}${btn("planRemove", "−", "mini-plus", `data-index="${i}" aria-label="移除动作"`)}</div>`;
          })
          .join("") +
        (planDraft.exerciseIds.length
          ? ""
          : empty("还没有动作", "点击“选择动作”建立自己的训练模版"));
      footer = `<div class="sheet-actions">${!planDraft.isNew ? btn("deletePlan", "删除", "danger-btn") : ""}${btn("savePlan", "保存模版", "primary wide")}</div>`;
    } else if (m.type === "customExercise") {
      const e = m.id ? customMovement(m.id) : null;
      if (m.id && !e) return closeModal();
      const used = e && C.customExerciseInUse(data, e.id);
      title = e ? "编辑自定义动作" : "自定义动作";
      content =
        field(
          "动作名称",
          "custom-name",
          e?.name || "",
          "text",
          'maxlength="60" placeholder="例如：我的绳索划船"',
        ) +
        selectField(
          "训练部位",
          "custom-category",
          [
            ...new Set([
              ...builtin.map((e) => e.category),
              "全身",
              "其他",
              ...(e ? [e.category] : []),
            ]),
          ],
          e?.category || "胸",
        ) +
        selectField(
          "器械",
          "custom-equipment",
          [
            ...new Set([
              "自重",
              "哑铃",
              "杠铃",
              "器械",
              "绳索",
              "其他",
              ...(e ? [e.equipment] : []),
            ]),
          ],
          e?.equipment || "自重",
        ) +
        selectField(
          "记录方式",
          "custom-mode",
          [
            ["weight", "重量 + 次数"],
            ["reps", "次数"],
            ["time", "时间（秒）"],
          ],
          e?.mode || "weight",
          used ? "disabled" : "",
        ) +
        (used
          ? '<p class="hint">已有训练记录，记录方式保持不变。其他信息可继续编辑。</p>'
          : "") +
        `<label class="sheet-field"><span>动作说明（可选）</span><textarea id="custom-notes" maxlength="2000" rows="3" placeholder="例如器械档位、动作要点或自己的习惯">${esc(e?.notes || "")}</textarea></label><p class="hint">使用缺省图，保存在本机，并随备份一起导出。</p>`;
      footer = btn("saveCustom", "保存动作", "primary wide start");
    } else if (m.type === "exerciseMenu") {
      const e = data.active?.exercises.find((x) => x.id === m.id);
      if (!e) return closeModal();
      title = e.name;
      content =
        '<p class="hint">组号可切换普通组、热身组 W、递减组 D。每一组都可以单独修改。</p>';
      footer = btn(
        "removeExercise",
        "从本次训练中移除",
        "danger-btn wide start",
        `data-id="${esc(e.id)}"`,
      );
    } else if (m.type === "confirm") {
      title = m.title;
      content = `<p class="muted">${esc(m.message)}</p>`;
      footer = `<div class="sheet-actions">${btn("close", "取消", "secondary")}${btn(m.confirmAction, m.confirmLabel || "确认", "primary", m.id ? `data-id="${esc(m.id)}"` : "")}</div>`;
    } else if (m.type === "session") {
      const w = data.sessions.find((w) => w.id === m.id);
      if (!w) return closeModal();
      title = w.title;
      content = `<span class="tag green">${w.date} · 已完成</span>${setMetric(w)}${w.exercises.map((e) => `<div class="saved-exercise"><div class="row">${thumb(movement(e.exerciseId))}<h3>${esc(e.name)}</h3></div><div class="saved-set" style="padding:8px 0 0 5px">${e.sets.map((s, i) => `${s.type === "warmup" ? "W 热身" : s.type === "drop" ? "D 递减" : i + 1 + " 组"}　${e.mode === "time" ? s.seconds + " 秒" : e.mode === "reps" ? s.reps + " 次" : num(s.weight) + " kg × " + s.reps + " 次"}　✓`).join("<br>")}</div></div>`).join("")}${w.notes ? `<hr class="divider"><p class="muted">${esc(w.notes)}</p>` : ""}`;
      footer = `<div class="sheet-actions">${btn("deleteSession", "删除", "danger-btn", `data-id="${esc(w.id)}"`)}${btn("repeatSession", "再练一次", "primary", `data-id="${esc(w.id)}"`)}</div>`;
    } else if (m.type === "stats") {
      title = "训练统计";
      content = statsContent();
    } else if (m.type === "body") {
      title = "身体数据";
      content =
        field("记录日期", "body-date", C.dateKey(), "date") +
        `<div class="form-row">${field("体重（kg）", "body-weight", "", "number", 'min="1" max="600" step="0.1" inputmode="decimal"')}${field("腰围（cm，可选）", "body-waist", "", "number", 'min="0" max="400" step="0.1" inputmode="decimal"')}</div>` +
        btn("saveBody", "保存记录", "primary wide start") +
        `<p class="hint">仅保存在这台设备上，可随备份导出。</p><hr class="divider">${data.bodyLogs
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 30)
          .map(
            (e) =>
              `<div class="setting-row"><span class="grow">${e.date}</span><strong>${num(e.weight)} kg</strong><small>${e.waist ? num(e.waist) + " cm" : ""}</small>${btn("deleteBody", "×", "mini-plus", `data-id="${esc(e.id)}" aria-label="删除${e.date}身体记录"`)}</div>`,
          )
          .join("")}`;
    } else if (m.type === "timerSettings") {
      title = "组间休息";
      content = `<div class="chips">${[30, 60, 90, 120, 180].map((s) => btn("setRest", s + " 秒", "chip " + (data.settings.restSeconds === s ? "active" : ""), `data-seconds="${s}"`)).join("")}</div>${field("自定义时长（秒，0 表示关闭自动休息）", "rest-seconds", data.settings.restSeconds, "number", 'min="0" max="3600" step="1"')}<p class="hint">完成一组后自动开始倒计时。切回 APP 时会按实际时间恢复；当前版本不提供锁屏提醒音。</p>`;
      footer = `<div class="sheet-actions">${btn("saveRest", "保存设置", "secondary")}${btn("startRest", "立即计时", "primary")}</div>`;
    } else if (m.type === "weekGoal") {
      title = "每周训练目标";
      content = selectField(
        "计划每周训练多少天",
        "week-goal",
        [1, 2, 3, 4, 5, 6, 7].map((x) => [String(x), x + " 天"]),
        String(data.settings.weekGoal),
      );
      footer = btn("saveGoal", "保存目标", "primary wide start");
    } else if (m.type === "importConfirm") {
      title = "导入备份";
      content = `<p>备份包含 <strong>${m.data.sessions.length}</strong> 次训练、<strong>${m.data.plans.length}</strong> 个模版和 <strong>${m.data.bodyLogs.length}</strong> 条身体记录。</p><p class="hint">确认后会替换本机当前数据，建议先导出当前备份。</p>`;
      footer = `<div class="sheet-actions">${btn("close", "取消", "secondary")}${btn("applyImport", "确认替换", "primary")}</div>`;
    } else if (m.type === "storageError") {
      title = "本地数据读取失败";
      content =
        "<p>当前数据暂时无法读取，已停止写入以保护原文件。请先导出原始数据，或导入之前保存的日跻备份。</p>";
      footer = `<div class="sheet-actions">${btn("exportRaw", "导出原始数据", "secondary")}${btn("import", "导入备份", "primary")}</div>`;
    } else if (m.type === "about") {
      title = "关于日跻";
      content = `<div class="row about-brand"><div class="brand-icon"><img src="brand-mark.svg" alt="" width="44" height="44"></div><div><h2>日跻 1.0.6</h2><small>力量训练记录</small></div></div><p>如月之恒，如日之升</p><p class="hint">——《诗经·小雅·天保》</p><p>参照训记的核心训练流程独立实现，无需账号即可记录和查看训练。</p><hr class="divider"><h3>你的数据</h3><p class="hint">训练、模版、收藏和身体记录均保存在本机。APP 不申请联网、通讯录、定位、相机或手机号权限。卸载会删除本地记录，请提前导出 JSON 备份。</p><h3>动作图片</h3><p class="hint">${builtin.filter((e) => animationFor(e)).length} 个动作已配备离线动画，红色高亮提示参与肌群。当前为待检查版本；自定义动作使用缺省图。不使用原版 APK 的图片和动画。</p><h3>当前范围</h3><p class="hint">支持训练记录、普通/热身/递减组、休息计时、个人模版、动作收藏与自定义动作新建/编辑/删除、历史、容量统计、身体数据和备份。未接入原版账号、AI、云端、社区、饮食服务及手表联动。</p>`;
    }
    $("#overlay").innerHTML = modalFrame(title, content, footer);
  }
  function pickerResults() {
    const m = modal,
      entries = filteredCatalog(
        m.category || "胸",
        m.query || "",
        "全部",
        false,
      );
    return (
      entries
        .slice(0, m.limit || 60)
        .map(
          (e) =>
            `<button class="move-row" data-action="pick" data-id="${esc(e.id)}">${thumb(e)}<div class="grow"><div class="move-name">${esc(e.name)}</div><div class="move-meta">${esc(e.category)} · ${esc(e.equipment)}</div></div><span class="check-circle ${(m.selected || []).includes(e.id) ? "checked" : ""}">${(m.selected || []).includes(e.id) ? icon("check") : ""}</span></button>`,
        )
        .join("") +
      (entries.length > (m.limit || 60)
        ? btn("pickerMore", "加载更多", "text-btn wide")
        : "") +
      (entries.length
        ? ""
        : empty("没有匹配的动作", "试试搜索更短的名字", "search"))
    );
  }
  function statsContent() {
    const weeks = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - 6 + i);
        const date = C.dateKey(d);
        return {
          date,
          label: ["日", "一", "二", "三", "四", "五", "六"][d.getDay()],
          volume: data.sessions
            .filter((w) => w.date === date)
            .reduce((n, w) => n + C.workoutStats(w).volume, 0),
        };
      }),
      max = Math.max(1, ...weeks.map((x) => x.volume)),
      parts = {},
      pr = new Map(),
      today = new Date(),
      monday = new Date(today);
    monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const count = new Set(
      data.sessions
        .filter((w) => w.date >= C.dateKey(monday) && w.date <= C.dateKey())
        .map((w) => w.date),
    ).size;
    for (const w of data.sessions)
      for (const e of w.exercises) {
        if (e.mode !== "weight") continue;
        const volume = e.sets
          .filter((s) => s.done)
          .reduce((n, s) => n + s.weight * s.reps, 0);
        parts[e.category] = (parts[e.category] || 0) + volume;
        for (const s of e.sets)
          if (s.done && s.weight > (pr.get(e.exerciseId)?.weight || 0))
            pr.set(e.exerciseId, {
              name: e.name,
              weight: s.weight,
              reps: s.reps,
            });
      }
    const total = Object.values(parts).reduce((a, b) => a + b, 0);
    return `<div class="card"><div class="between"><h3>本周训练</h3><span class="tag green">${count} / ${data.settings.weekGoal} 天</span></div><div class="part-bar" style="margin-top:14px"><span style="width:${Math.min(100, (count / Math.max(1, data.settings.weekGoal)) * 100)}%"></span></div><p class="hint">每一个有记录的训练日，都算一次坚持。</p></div><div class="card"><div class="between"><h3>近 7 天训练容量</h3><small>kg</small></div><div class="bars">${weeks.map((d) => `<div class="bar"><div class="bar-column" style="height:${Math.max(3, (d.volume / max) * 85)}px" title="${num(d.volume)} kg"></div><small>${d.label}</small></div>`).join("")}</div><p class="hint">合计 ${num(weeks.reduce((n, d) => n + d.volume, 0))} kg</p></div><div class="section"><h3>部位容量分布</h3></div>${
      Object.entries(parts)
        .sort((a, b) => b[1] - a[1])
        .map(
          ([p, v]) =>
            `<div class="between"><span>${esc(p)}</span><small>${num(v)} kg</small></div><div class="part-bar"><span style="width:${total ? (v / total) * 100 : 0}%"></span></div>`,
        )
        .join("") ||
      empty("还没有容量数据", "完成带重量的训练后查看分布", "chart")
    }<div class="section"><h3>动作个人纪录 · PR</h3></div>${
      [...pr.values()]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 30)
        .map(
          (p) =>
            `<div class="setting-row"><span class="grow">${esc(p.name)}</span><strong class="accent">${num(p.weight)} kg</strong><small>× ${p.reps}</small></div>`,
        )
        .join("") ||
      '<p class="hint">保存训练后，自动记录每个动作的最高重量。</p>'
    }`;
  }

  function ensureActive() {
    if (!data.active)
      persist(C.startWorkout(data, { date: selectedDay }, catalog()));
  }
  function beginPlan(id) {
    const plan = [...data.plans, ...presets()].find((p) => p.id === id);
    if (!plan) throw Error("模版不存在");
    persist(C.startPlan(data, plan, catalog(), selectedDay));
    tab = "training";
    closeModal();
    render();
  }
  function exportText(text) {
    if (native()) NativeStore.exportBackup(text);
    else {
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "日跻备份-" + C.dateKey() + ".json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  function restValue() {
    const n = Number($("#rest-seconds")?.value);
    if (!Number.isInteger(n) || n < 0 || n > 3600)
      throw Error("休息时间请输入 0–3600 秒的整数");
    return n;
  }
  function startRestTimer(seconds) {
    mutate((s) => {
      s.timer = seconds
        ? { endsAt: Date.now() + seconds * 1000, duration: seconds }
        : null;
    });
    renderTimer();
  }
  function validateName(value) {
    const name = String(value || "").trim();
    if (!name || name.length > 100) throw Error("请填写 1–100 字的名称");
    return name;
  }
  const handlers = {
    toggleMotion() {
      setMotionPlaying(!!modal?.paused);
    },
    tab(el) {
      tab = el.dataset.tab;
      closeModal();
      render();
      window.scrollTo(0, 0);
    },
    day(el) {
      selectedDay = el.dataset.date;
      render();
    },
    newWorkout() {
      if (data.active) {
        toast("已有进行中的训练，请先完成或放弃");
        tab = "training";
        render();
        return;
      }
      openModal("newWorkout");
    },
    startWorkout() {
      const title = validateName($("#new-title").value),
        date = $("#new-date").value;
      if (!C.validDate(date)) throw Error("请选择有效日期");
      persist(C.startWorkout(data, { title, date }, catalog()));
      selectedDay = date;
      tab = "training";
      openModal("picker", { selected: [], category: "胸", target: "workout" });
      render();
    },
    addMovements() {
      openModal("picker", { selected: [], category: "胸", target: "workout" });
    },
    close() {
      closeModal();
    },
    backdrop(el, event) {
      if (event.target === el) closeModal();
    },
    category(el) {
      category = el.dataset.value;
      limit = 45;
      render();
    },
    equipment(el) {
      equipment = el.dataset.value;
      limit = 45;
      render();
    },
    favorites() {
      favoritesOnly = !favoritesOnly;
      limit = 45;
      render();
    },
    loadMore() {
      limit += 60;
      $("#movement-results").innerHTML = movementResults();
    },
    detail(el) {
      openModal("detail", { id: el.dataset.id });
    },
    quickAdd(el) {
      ensureActive();
      persist(C.addExercise(data, el.dataset.id, catalog()));
      closeModal();
      tab = "training";
      render();
      toast("已加入训练");
    },
    pick(el) {
      const id = el.dataset.id,
        selected = modal.selected || (modal.selected = []),
        idx = selected.indexOf(id);
      if (idx < 0) selected.push(id);
      else selected.splice(idx, 1);
      $("#picker-results").innerHTML = pickerResults();
      $("#confirm-picker").textContent = `添加已选（${selected.length}）`;
    },
    pickerMore() {
      modal.limit = (modal.limit || 60) + 60;
      $("#picker-results").innerHTML = pickerResults();
    },
    confirmPicker() {
      const selected = modal.selected || [];
      if (!selected.length) throw Error("请至少选择一个动作");
      if (modal.target === "plan") {
        planDraft.exerciseIds = [...selected];
        openModal("planEdit");
        return;
      }
      let next = data;
      for (const id of selected) next = C.addExercise(next, id, catalog());
      persist(next);
      closeModal();
      render();
    },
    addSet(el) {
      mutate((s) => {
        const e = s.active.exercises.find((x) => x.id === el.dataset.id),
          last = e.sets[e.sets.length - 1];
        e.sets.push(
          last ? { ...last, id: C.uid(), done: false } : C.initialSet(e.mode),
        );
      });
      render();
    },
    removeSet(el) {
      mutate((s) => {
        const e = s.active.exercises.find((x) => x.id === el.dataset.e);
        e.sets = e.sets.filter((x) => x.id !== el.dataset.s);
      });
      render();
    },
    setType(el) {
      const e = data.active.exercises.find((x) => x.id === el.dataset.e),
        s = e.sets.find((x) => x.id === el.dataset.s),
        types = ["normal", "warmup", "drop"];
      persist(
        C.updateSet(data, e.id, s.id, {
          type: types[(types.indexOf(s.type) + 1) % 3],
        }),
      );
      render();
    },
    toggleSet(el) {
      const e = data.active.exercises.find((x) => x.id === el.dataset.e),
        s = e.sets.find((x) => x.id === el.dataset.s);
      if (!s.done && (e.mode === "time" ? s.seconds <= 0 : s.reps <= 0))
        throw Error(
          e.mode === "time" ? "先填写有效的训练秒数" : "先填写有效的次数",
        );
      persist(C.updateSet(data, e.id, s.id, { done: !s.done }));
      if (!s.done && data.settings.restSeconds)
        startRestTimer(data.settings.restSeconds);
      render();
    },
    exerciseMenu(el) {
      openModal("exerciseMenu", { id: el.dataset.id });
    },
    removeExercise(el) {
      mutate((s) => {
        s.active.exercises = s.active.exercises.filter(
          (x) => x.id !== el.dataset.id,
        );
      });
      closeModal();
      render();
    },
    finish() {
      if (!C.workoutStats(data.active).sets)
        throw Error("至少完成一组后才能保存训练");
      const s = C.workoutStats(data.active);
      openModal("confirm", {
        title: "完成本次训练",
        message: `已完成 ${s.sets} 组，训练容量 ${num(s.volume)} kg。保存时只保留已勾选的组。`,
        confirmAction: "confirmFinish",
        confirmLabel: "保存训练",
      });
    },
    confirmFinish() {
      persist(C.finishWorkout(data));
      closeModal();
      render();
      toast("训练已保存，今天也有进步。");
    },
    discard() {
      openModal("confirm", {
        title: "放弃本次训练",
        message: "本次尚未保存的训练会被删除，历史记录不受影响。",
        confirmAction: "confirmDiscard",
        confirmLabel: "放弃训练",
      });
    },
    confirmDiscard() {
      mutate((s) => {
        s.active = null;
        s.timer = null;
      });
      closeModal();
      render();
    },
    newPlan() {
      planDraft = { id: C.uid(), name: "", exerciseIds: [], isNew: true };
      openModal("planEdit");
    },
    plan(el) {
      openModal("plan", { id: el.dataset.id });
    },
    startPlan(el) {
      beginPlan(el.dataset.id);
    },
    editPlan(el) {
      const p = [...data.plans, ...presets()].find(
        (p) => p.id === el.dataset.id,
      );
      if (!p) throw Error("模版不存在");
      const isNew = p.id.startsWith("preset-");
      planDraft = { ...C.clone(p), id: isNew ? C.uid() : p.id, isNew };
      openModal("planEdit");
    },
    planPicker() {
      planDraft.name = $("#plan-name").value;
      openModal("picker", {
        target: "plan",
        selected: [...planDraft.exerciseIds],
        category: "胸",
      });
    },
    planRemove(el) {
      planDraft.name = $("#plan-name").value;
      planDraft.exerciseIds.splice(Number(el.dataset.index), 1);
      renderModal();
    },
    planUp(el) {
      planDraft.name = $("#plan-name").value;
      const i = Number(el.dataset.index);
      [planDraft.exerciseIds[i - 1], planDraft.exerciseIds[i]] = [
        planDraft.exerciseIds[i],
        planDraft.exerciseIds[i - 1],
      ];
      renderModal();
    },
    savePlan() {
      const name = validateName($("#plan-name").value);
      if (!planDraft.exerciseIds.length) throw Error("请至少添加一个动作");
      mutate((s) => {
        const p = {
            id: planDraft.id,
            name,
            exerciseIds: planDraft.exerciseIds,
          },
          idx = s.plans.findIndex((x) => x.id === p.id);
        if (idx < 0) s.plans.push(p);
        else s.plans[idx] = p;
      });
      closeModal();
      render();
      toast("模版已保存");
    },
    deletePlan() {
      openModal("confirm", {
        title: "删除模版",
        message: "只删除模版，不影响训练历史。",
        confirmAction: "confirmDeletePlan",
        id: planDraft.id,
        confirmLabel: "删除模版",
      });
    },
    confirmDeletePlan(el) {
      mutate((s) => {
        s.plans = s.plans.filter((p) => p.id !== el.dataset.id);
      });
      closeModal();
      render();
    },
    saveAsPlan() {
      if (!data.active?.exercises.length) throw Error("先添加动作再保存模版");
      planDraft = {
        id: C.uid(),
        name: data.active.title,
        exerciseIds: [
          ...new Set(data.active.exercises.map((e) => e.exerciseId)),
        ],
        isNew: true,
      };
      openModal("planEdit");
    },
    customExercise() {
      openModal("customExercise");
    },
    customFromPicker() {
      openModal("customExercise", { returnTo: C.clone(modal) });
    },
    editCustom(el) {
      openModal("customExercise", { id: el.dataset.id });
    },
    saveCustom() {
      const editId = modal.id,
        returnTo = modal.returnTo;
      persist(
        C.saveCustomExercise(
          data,
          {
            ...(editId ? { id: editId } : {}),
            name: $("#custom-name").value,
            category: $("#custom-category").value,
            equipment: $("#custom-equipment").value,
            mode: $("#custom-mode").value,
            notes: $("#custom-notes").value,
          },
          builtin,
        ),
      );
      const id = editId || data.customExercises.at(-1).id;
      modal = null;
      closeModal();
      if (returnTo) {
        returnTo.selected = [...new Set([...(returnTo.selected || []), id])];
        returnTo.category = "自定义";
        returnTo.query = "";
        openModal("picker", returnTo);
      } else {
        category = "自定义";
        search = "";
        equipment = "全部";
        favoritesOnly = false;
        tab = "movements";
        render();
      }
      toast("自定义动作已保存");
    },
    deleteCustom(el) {
      openModal("confirm", {
        title: "删除自定义动作",
        message:
          "从动作库和收藏中移除，已有训练、模版和历史记录保留。可在“已删除”分类中恢复。",
        confirmAction: "confirmDeleteCustom",
        confirmLabel: "删除动作",
        id: el.dataset.id,
      });
    },
    confirmDeleteCustom(el) {
      persist(C.archiveCustomExercise(data, el.dataset.id));
      closeModal();
      render();
      toast("已从动作库移除，训练记录已保留");
    },
    restoreCustom(el) {
      persist(C.archiveCustomExercise(data, el.dataset.id, false));
      category = "自定义";
      search = "";
      equipment = "全部";
      favoritesOnly = false;
      renderModal();
      if (tab === "movements") render();
      toast("动作已恢复");
    },
    favorite(el) {
      const id = el.dataset.id;
      mutate((s) => {
        s.favorites = s.favorites.includes(id)
          ? s.favorites.filter((x) => x !== id)
          : [...s.favorites, id];
      });
      renderModal();
      if (tab === "movements")
        $("#movement-results").innerHTML = movementResults();
    },
    showFavorites() {
      tab = "movements";
      favoritesOnly = true;
      category = "全部";
      search = "";
      equipment = "全部";
      render();
    },
    allPlans() {
      tab = "training";
      render();
    },
    session(el) {
      openModal("session", { id: el.dataset.id });
    },
    deleteSession(el) {
      openModal("confirm", {
        title: "删除训练记录",
        message: "这次训练及其统计将被删除，其他记录不受影响。",
        confirmAction: "confirmDeleteSession",
        id: el.dataset.id,
        confirmLabel: "删除记录",
      });
    },
    confirmDeleteSession(el) {
      mutate((s) => {
        s.sessions = s.sessions.filter((w) => w.id !== el.dataset.id);
      });
      closeModal();
      render();
      toast("记录已删除");
    },
    repeatSession(el) {
      if (data.active) throw Error("已有进行中的训练，请先完成或放弃");
      const w = data.sessions.find((x) => x.id === el.dataset.id);
      let s = C.startWorkout(
        data,
        { title: w.title, date: C.dateKey() },
        catalog(),
      );
      s.active.exercises = C.clone(w.exercises).map((e) => ({
        ...e,
        id: C.uid(),
        sets: e.sets.map((t) => ({ ...t, id: C.uid(), done: false })),
      }));
      persist(s);
      selectedDay = C.dateKey();
      tab = "training";
      closeModal();
      render();
    },
    historyDay(el) {
      historyDay = historyDay === el.dataset.date ? "" : el.dataset.date;
      render();
    },
    clearHistoryDay() {
      historyDay = "";
      render();
    },
    prevMonth() {
      changeMonth(-1);
    },
    nextMonth() {
      changeMonth(1);
    },
    stats() {
      openModal("stats");
    },
    theme() {
      mutate((s) => {
        s.settings.theme = s.settings.theme === "dark" ? "light" : "dark";
      });
      render();
    },
    timerSettings() {
      openModal("timerSettings");
    },
    setRest(el) {
      $("#rest-seconds").value = el.dataset.seconds;
    },
    saveRest() {
      const value = restValue();
      mutate((s) => {
        s.settings.restSeconds = value;
      });
      closeModal();
      render();
    },
    startRest() {
      const value = restValue();
      mutate((s) => {
        s.settings.restSeconds = value;
        s.timer = value
          ? { endsAt: Date.now() + value * 1000, duration: value }
          : null;
      });
      closeModal();
      render();
    },
    timerPlus() {
      mutate((s) => {
        s.timer.endsAt = Math.max(Date.now(), s.timer.endsAt) + 30000;
      });
      renderTimer();
    },
    timerStop() {
      mutate((s) => {
        s.timer = null;
      });
      render();
    },
    weekGoal() {
      openModal("weekGoal");
    },
    saveGoal() {
      const value = Number($("#week-goal").value);
      mutate((s) => {
        s.settings.weekGoal = value;
      });
      closeModal();
      render();
    },
    body() {
      openModal("body");
    },
    saveBody() {
      const date = $("#body-date").value,
        weight = Number($("#body-weight").value),
        waist = Number($("#body-waist").value);
      if (
        !C.validDate(date) ||
        !Number.isFinite(weight) ||
        weight <= 0 ||
        weight > 600 ||
        !Number.isFinite(waist) ||
        waist < 0 ||
        waist > 400
      )
        throw Error("请填写有效日期、体重和腰围");
      mutate((s) => {
        s.bodyLogs = s.bodyLogs.filter((x) => x.date !== date);
        s.bodyLogs.unshift({ id: C.uid(), date, weight, waist });
      });
      renderModal();
      toast("身体数据已保存");
    },
    deleteBody(el) {
      openModal("confirm", {
        title: "删除身体记录",
        message: "删除这一条身体数据。",
        confirmAction: "confirmDeleteBody",
        id: el.dataset.id,
        confirmLabel: "删除记录",
      });
    },
    confirmDeleteBody(el) {
      mutate((s) => {
        s.bodyLogs = s.bodyLogs.filter((x) => x.id !== el.dataset.id);
      });
      openModal("body");
    },
    export() {
      exportText(C.exportBackup(data));
    },
    exportRaw() {
      exportText(rawStored);
    },
    import() {
      if (native()) NativeStore.importBackup();
      else $("#import-file").click();
    },
    applyImport() {
      const next = modal.data,
        wasBroken = storageBroken;
      storageBroken = false;
      try {
        persist(next);
      } catch (e) {
        storageBroken = wasBroken;
        throw e;
      }
      closeModal();
      render();
      toast("备份已恢复");
    },
    about() {
      openModal("about");
    },
  };
  function changeMonth(delta) {
    const d = new Date(historyMonth + "-15T12:00:00");
    d.setMonth(d.getMonth() + delta);
    historyMonth = C.dateKey(d).slice(0, 7);
    historyDay = "";
    render();
  }
  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const action = handlers[el.dataset.action];
    if (action) safe(() => action(el, event));
  });
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (el.id === "movement-search") {
      search = el.value;
      limit = 45;
      if (search && category !== "全部") {
        category = "全部";
        document
          .querySelectorAll(".cat")
          .forEach((x) =>
            x.classList.toggle("active", x.dataset.value === "全部"),
          );
      }
      $("#movement-results").innerHTML = movementResults();
    } else if (el.id === "picker-search") {
      modal.query = el.value;
      if (el.value) {
        modal.category = "全部";
        $("#picker-category").value = "全部";
      }
      modal.limit = 60;
      $("#picker-results").innerHTML = pickerResults();
    } else if (el.id === "plan-name") {
      planDraft.name = el.value;
    } else if (el.id === "workout-notes") {
      safe(() =>
        mutate((s) => {
          s.active.notes = el.value;
        }),
      );
    }
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.field) {
      safe(() =>
        persist(
          C.updateSet(data, el.dataset.e, el.dataset.s, {
            [el.dataset.field]: el.value,
          }),
        ),
      );
      const ex = data.active.exercises.find((e) => e.id === el.dataset.e),
        set = ex.sets.find((s) => s.id === el.dataset.s);
      el.value = set[el.dataset.field];
    } else if (el.id === "picker-category") {
      modal.category = el.value;
      modal.limit = 60;
      $("#picker-results").innerHTML = pickerResults();
    } else if (el.id === "import-file") {
      const file = el.files[0];
      if (file) {
        if (file.size > 16 * 1024 * 1024) toast("备份文件超过 16 MB");
        else
          file
            .text()
            .then(window.receiveImport)
            .catch(() => toast("无法读取文件"));
      }
      el.value = "";
    }
  });
  window.nativeMessage = toast;
  window.pauseExerciseAnimation = () => setMotionPlaying(false);
  window.receiveImport = (text) =>
    safe(() => {
      const imported = C.importBackup(text);
      openModal("importConfirm", { data: imported });
    });
  let welcomeTimer;
  function dismissWelcome() {
    const welcome = $("#welcome");
    if (!welcome) return false;
    clearTimeout(welcomeTimer);
    welcome.remove();
    document.body.classList.remove("welcoming");
    $("#app").inert = false;
    $("#overlay").inert = false;
    return true;
  }
  $("#welcome").addEventListener("click", dismissWelcome);
  window.handleBack = () => {
    if (dismissWelcome()) return true;
    if (modal) {
      closeModal();
      return true;
    }
    if (tab !== "training") {
      tab = "training";
      render();
      return true;
    }
    return false;
  };
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") window.handleBack();
  });
  setInterval(() => {
    const clock = $("#active-duration");
    if (clock && data.active)
      clock.textContent = duration(C.workoutStats(data.active).duration);
    if (data.timer) renderTimer();
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      setMotionPlaying(false);
      dismissWelcome();
    }
    if (!document.hidden) renderTimer();
  });
  render();
  welcomeTimer = setTimeout(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dismissWelcome();
    } else {
      $("#welcome")?.classList.add("leaving");
      welcomeTimer = setTimeout(dismissWelcome, 180);
    }
  }, 1200);
})();
