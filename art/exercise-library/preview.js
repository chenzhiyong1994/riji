(() => {
  'use strict';
  const specs = window.LIBRARY_PREVIEW || [];
  const key = 'riji-animation-review-v1';
  const labels = { pending: '待检查', keep: '保留', repair: '需修复', remove: '删除' };
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let active = null, reviews = {};
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) reviews = stored;
  } catch (_) {
    $('#storage-message').textContent = '浏览器未能读取检查记录；本次标记后请导出清单保存。';
  }
  function review(spec) {
    const item = reviews[spec.id];
    if (item && typeof item.status === 'string' && Object.hasOwn(labels, item.status)) {
      const outdated = item.sha256 !== spec.animationSha256;
      return { status: outdated ? 'pending' : item.status, note: typeof item.note === 'string' ? item.note.slice(0, 2000) : '', outdated };
    }
    return { status: 'pending', note: '', outdated: false };
  }
  function counts() {
    const totals = { pending: 0, keep: 0, repair: 0, remove: 0 };
    for (const spec of specs) totals[review(spec).status]++;
    $('#review-count').textContent = Object.keys(labels).map(s => `${labels[s]} ${totals[s]}`).join(' · ');
  }
  function pause() {
    if (!active) return;
    const card = $(`[data-index="${active}"]`), spec = specs.find(s => s.index === active);
    if (card) {
      card.querySelector('img').src = spec.poster;
      card.classList.remove('playing');
      card.querySelector('button').textContent = '播放动画';
      card.querySelector('button').setAttribute('aria-pressed', 'false');
    }
    active = null;
  }
  function render() {
    pause();
    const query = $('#search').value.trim(), category = $('#category').value;
    const status = $('#status').value, reviewFilter = $('#review-filter').value;
    const list = specs.filter(s => (!query || s.name.includes(query) || String(s.index).padStart(2, '0') === query)
      && (category === '全部' || s.category === category)
      && (status === 'all' || (status === 'encoded') === s.encoded)
      && (reviewFilter === 'all' || review(s).status === reviewFilter));
    $('#count').textContent = `已生成完整动图 ${specs.filter(s => s.encoded).length} / 80 · 当前显示 ${list.length} 项`;
    $('#grid').innerHTML = list.map(s => {
      const current = review(s);
      return `<article class="card" data-index="${s.index}"><div class="label"><p class="tag">${String(s.index).padStart(2, '0')} / ${esc(s.category)} · ${s.encoded ? '完整动图 · ' + labels[current.status] : s.poster ? '关键姿势预览' : '待制作'}</p><h2>${esc(s.name)}</h2></div><div class="stage">${s.poster ? `<img src="${esc(s.poster)}" loading="lazy" alt="${esc(s.name)}${s.encoded ? '动画封面' : '关键姿势预览'}">` : '<span class="empty">待制作</span>'}</div><div class="actions"><button ${s.encoded ? '' : 'disabled'} aria-pressed="false">${s.encoded ? '播放动画' : '动图尚未完成'}</button>${s.encoded ? `<div class="asset-links"><a href="${esc(s.animation)}" target="_blank" rel="noopener">放大动图 ↗</a><a href="output/${esc(s.slug)}/keyframes.jpg" target="_blank" rel="noopener">关键姿势 ↗</a></div>` : ''}</div><div class="review-fields">${current.outdated ? '<small class="review-outdated">动画已更新，旧备注保留供复查。</small>' : ''}<label>检查结果<select class="review-status" aria-label="${esc(s.name)}检查结果" ${s.encoded ? '' : 'disabled'}>${Object.keys(labels).map(status => `<option value="${status}" ${current.status === status ? 'selected' : ''}>${labels[status]}</option>`).join('')}</select></label><label>问题备注<textarea maxlength="2000" rows="2" class="review-note" aria-label="${esc(s.name)}问题备注" placeholder="例如：右手腕反向、杠铃穿过手掌" ${s.encoded ? '' : 'disabled'}>${esc(current.note)}</textarea></label></div></article>`;
    }).join('');
    counts();
  }
  for (const category of new Set(specs.map(s => s.category))) {
    const option = document.createElement('option');
    option.value = option.textContent = category; $('#category').append(option);
  }
  $('#grid').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const card = button.closest('.card'), index = Number(card.dataset.index);
    if (active === index) return pause();
    pause();
    const spec = specs.find(s => s.index === index);
    card.querySelector('img').src = spec.animation;
    card.classList.add('playing');
    button.textContent = '暂停动画'; button.setAttribute('aria-pressed', 'true'); active = index;
  });
  function saveReview(event) {
    if (!event.target.matches('.review-status, .review-note')) return;
    const card = event.target.closest('.card'), spec = specs.find(s => s.index === Number(card.dataset.index));
    reviews[spec.id] = { sha256: spec.animationSha256, status: card.querySelector('.review-status').value,
      note: card.querySelector('.review-note').value.slice(0, 2000) };
    card.querySelector('.review-outdated')?.remove();
    card.querySelector('.tag').textContent = `${String(spec.index).padStart(2, '0')} / ${spec.category} · 完整动图 · ${labels[reviews[spec.id].status]}`;
    try { localStorage.setItem(key, JSON.stringify(reviews)); }
    catch (_) { $('#storage-message').textContent = '浏览器未能保存检查记录；请导出清单，避免关闭后丢失。'; }
    counts();
  }
  $('#grid').addEventListener('input', saveReview);
  $('#grid').addEventListener('change', saveReview);
  $('#pause-all').addEventListener('click', pause);
  $('#search').addEventListener('input', render);
  for (const id of ['category', 'status', 'review-filter']) $('#' + id).addEventListener('change', render);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  $('#export-review').addEventListener('click', () => {
    const content = { format: 'riji-animation-review', version: 1, exportedAt: new Date().toISOString(),
      items: specs.map(s => ({ index: s.index, id: s.id, name: s.name, animationSha256: s.animationSha256,
        produced: s.encoded, ...review(s) })) };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '日跻-动作动画检查.json';
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
})();
