(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const panel = document.getElementById("app-preview");
  const image = document.getElementById("preview-image");
  const descriptions = {
    training: "训练页面：记录每组重量、次数与完成状态",
    movements: "动作页面：筛选常用动作或创建自定义动作",
    history: "历史页面：回看训练日历、容量与历史记录",
    profile: "我的页面：统计、身体数据、模版与备份工具",
  };
  function select(tab) {
    tabs.forEach((item) => {
      item.setAttribute("aria-selected", String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
    });
    image.src = `assets/${tab.dataset.screen}.png`;
    image.alt = descriptions[tab.dataset.screen];
    panel.setAttribute("aria-labelledby", tab.id);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight" || event.key === "ArrowDown")
        next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp")
        next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        select(tabs[next]);
        tabs[next].focus();
      }
    });
  });
})();
