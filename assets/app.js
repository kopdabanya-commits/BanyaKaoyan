/* 板牙考研 v2 —— 一张任务表、四个屏、一句话调整、云端同步。无框架、无构建。 */
(() => {
'use strict';

const KEY = 'banya_v2_state';
const $ = (sel) => document.querySelector(sel);
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const iso = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const shift = (date, n) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const weekday = (date) => ['周日','周一','周二','周三','周四','周五','周六'][new Date(date + 'T12:00:00').getDay()];
const today = () => iso();
const TYPES = ['阅读','翻译','写作','完形','新题型','单词','背诵','刷题','复盘','课程','其他'];

const API_BASE = (() => {
  const path = (typeof location !== 'undefined' && location.pathname) || '/';
  return location.origin + (path.startsWith('/v2/') ? '/v2/api' : '/api');
})();
const EXAM_DATE = '2026-12-19';
const DEFAULTS = () => ({
  tasks: [], rev: 0, dirty: false, undo: [], lastReview: '',
  prefs: { subject: 'english', apiBase: API_BASE, token: '', autoReview: true, theme: 'auto' }
});

let state = load();
let view = 'today';
let subject = state.prefs.subject === 'politics' ? 'politics' : 'english';
let selected = today();
let calMonth = today().slice(0, 7);
let syncState = 'idle';
let lastReport = null;
const DAILY_CAP = 150;

// 仅用于预览与自测：?demo=1 在没有任务时生成示例数据；?view=calendar|stats 直接切屏。
const params = new URLSearchParams(location.search);
if (params.get('demo') === '1' && !state.tasks.length) {
  const d = today();
  const mk = (date, title, type, minutes, done = false, score = null, subject = 'english') => ({ id: uid(), subject, date, title, type,
    minutes, done, notDone: false, actualMinutes: done ? minutes + 5 : null, note: '', score, scoreMax: 10, updatedAt: Date.now() });
  state.tasks = [
    mk(d, '阅读真题 2021 Text 1', '阅读', 40),
    mk(d, '翻译：长难句 5 句', '翻译', 30, true),
    mk(d, '徐涛强化课：马原 辩证法', '课程', 25, false, null, 'politics'),
    mk(shift(d, 1), '写作：小作文模板', '写作', 35),
    mk(shift(d, -1), '完形 2019', '完形', 25, false),
    mk(shift(d, -2), '阅读真题 2020 Text 2', '阅读', 40, true, 8),
    mk(shift(d, -20), '2022 Text 1', '阅读', 40, true, 6),
    mk(shift(d, -22), '2022 Text 2', '阅读', 40, true, 8),
    mk(shift(d, -25), '2023 Text 1', '阅读', 40, true, 8),
    mk(shift(d, -27), '2023 Text 2', '阅读', 40, true, null),
    mk(shift(d, -30), '2021 Text 3', '阅读', 40, true, 4)
  ];
  state.dirty = false; save();
}
if (['calendar', 'stats', 'me'].includes(params.get('view'))) view = params.get('view');
if (['english', 'politics'].includes(params.get('subject'))) { subject = params.get('subject'); state.prefs.subject = subject; }

function load() {
  const base = DEFAULTS();
  // 首次打开（还没有本地状态）也要带上部署时注入的同步密码
  if (!base.prefs.token) base.prefs.token = (window.BANYA_CONFIG || {}).token || '';
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return base;
    return {
      tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
      rev: Number(raw.rev) || 0,
      dirty: !!raw.dirty,
      lastReview: raw.lastReview || '',
      undo: Array.isArray(raw.undo) ? raw.undo : [],
      lastReview: raw.lastReview || '',
      prefs: (() => {
        const merged = { ...base.prefs, ...(raw.prefs || {}) };
        if (!merged.apiBase) merged.apiBase = API_BASE;
        if (!merged.token) merged.token = (window.BANYA_CONFIG || {}).token || '';
        return merged;
      })()
    };
  } catch { return base; }
}
function save() {
  state.undo = state.undo.slice(-15);
  state.tasks = prune(state.tasks);
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function prune(tasks) {
  const cutoff = Date.now() - 45 * 86400000;
  return tasks.filter((t) => !t.deleted || (t.updatedAt || 0) > cutoff);
}
function touch(t) { t.updatedAt = Date.now(); state.dirty = true; }
function pushUndo() { state.undo.push({ at: Date.now(), tasks: JSON.parse(JSON.stringify(state.tasks)) }); }
function undoLast() {
  const last = state.undo.pop();
  if (!last) return false;
  state.tasks = last.tasks; state.dirty = true; save(); render(); return true;
}

/* ---------------- 数据 ---------------- */
const live = () => state.tasks.filter((t) => !t.deleted);
const mine = (t) => t.subject === subject;
const ofDate = (date) => live().filter((t) => mine(t) && t.date === date)
  .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.title.localeCompare(b.title));
const openTask = (t) => !t.done && !t.notDone;
const sum = (list, key) => list.reduce((n, t) => n + Number(t[key] || 0), 0);

function addTask(patch) {
  const t = { id: uid(), subject, date: today(), title: '新任务', type: '阅读', minutes: 30,
    done: false, notDone: false, actualMinutes: null, note: '', updatedAt: Date.now(), ...patch };
  state.tasks.push(t); state.dirty = true; save(); return t;
}
const findTask = (id) => state.tasks.find((t) => t.id === id && !t.deleted);

function rangeStats(from, to) {
  const list = live().filter((t) => mine(t) && t.date >= from && t.date <= to);
  const done = list.filter((t) => t.done);
  return {
    list, done,
    actualMinutes: done.reduce((n, t) => n + Number(t.actualMinutes || t.minutes || 0), 0),
    planMinutes: sum(list, 'minutes'),
    rate: list.length ? Math.round(done.length / list.length * 100) : 0
  };
}
function progress() {
  const start = today();
  const future = live().filter((t) => mine(t) && t.date >= start && openTask(t));
  const remain = sum(future, 'minutes');
  const end = EXAM_DATE;
  const days = Math.max(1, Math.round((new Date(end + 'T12:00:00') - new Date(start + 'T12:00:00')) / 86400000));
  const week = rangeStats(shift(start, -6), start);
  const actual = Math.round(week.actualMinutes / 7);
  const required = Math.ceil(remain / days);
  return { remain, count: future.length, days, required, actual, behind: days >= 3 && required > 0 && actual < required * 0.8, end };
}

/* ---------------- 每日整理（触发器 + 策略 + 汇报） ---------------- */
function dayLoad(date) {
  return sum(live().filter((t) => mine(t) && t.date === date), 'minutes');
}
function nextDayWithRoom(date, need, horizon = 45) {
  let cursor = date;
  for (let i = 0; i < horizon; i++) {
    if (dayLoad(cursor) + need <= DAILY_CAP) return cursor;
    cursor = shift(cursor, 1);
  }
  return shift(date, horizon);
}
function dailyReview(force = false) {
  const day = today();
  if (!force && (!state.prefs.autoReview || state.lastReview === day)) return null;
  const snapshot = JSON.parse(JSON.stringify(state.tasks));
  const fixes = [];
  const now = Date.now();

  // 1) 逾期未做：按容量分散到今天起，而不是全堆到今天
  const overdue = live().filter((t) => mine(t) && t.date < day && openTask(t))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const t of overdue) {
    const target = nextDayWithRoom(day, t.minutes);
    if (target === t.date) continue;
    fixes.push({ kind: 'overdue', id: t.id, title: t.title, from: t.date, to: target });
    t.date = target; t.updatedAt = now;
  }

  // 2) 未来 14 天超载：把当天最小的任务往后挪，保证每天不超过上限
  for (let i = 0; i < 14; i++) {
    const date = shift(day, i);
    let items = live().filter((t) => mine(t) && t.date === date && openTask(t)).sort((a, b) => b.minutes - a.minutes);
    let total = dayLoad(date);
    while (total > DAILY_CAP && items.length > 1) {
      const t = items.pop();
      const target = nextDayWithRoom(shift(date, 1), t.minutes);
      fixes.push({ kind: 'overload', id: t.id, title: t.title, from: t.date, to: target });
      t.date = target; t.updatedAt = now;
      total -= t.minutes;
    }
  }

  state.lastReview = day;
  if (fixes.length) {
    state.undo.push({ at: Date.now(), tasks: snapshot });
    state.dirty = true; save(); schedulePush();
  } else save();
  return fixes.length ? { date: day, fixes } : null;
}



/* ---------------- 首次连接 ---------------- */
function takeTokenFromLink() {
  const m = location.hash.match(/token=([^&]+)/);
  if (!m) return false;
  state.prefs.token = decodeURIComponent(m[1]);
  save();
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}

function autoReclassify() {
  if (state.prefs.reclassified) return 0;
  let changed = 0;
  for (const t of state.tasks) {
    if (t.deleted) continue;
    const s = guessSubject(t.title);
    if (s && s !== t.subject) { t.subject = s; touch(t); changed++; }
  }
  state.prefs.reclassified = true;
  if (changed) { state.dirty = true; save(); }
  return changed;
}


/* ---------------- 版本 ---------------- */
const APP_VERSION = (window.BANYA_CONFIG || {}).version || '';
let latest = null;

async function checkUpdate(manual) {
  try {
    const r = await fetch('./api/version?ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('bad');
    const data = await r.json();
    if (data.version && APP_VERSION && data.version !== APP_VERSION) {
      latest = data;
      if (manual) toast('有新版本，点这里更新', () => forceUpdate());
      else toast('有新版本，点这里更新', () => forceUpdate());
      return true;
    }
    if (manual) toast('已是最新版本');
    return false;
  } catch {
    if (manual) toast('检查失败，稍后再试');
    return false;
  }
}

async function forceUpdate() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();
  } catch {}
  location.reload();
}

/* ---------------- 主题 ---------------- */
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
function resolveTheme() {
  const pref = state.prefs.theme || 'auto';
  if (pref === 'light' || pref === 'dark') return pref;
  return darkQuery.matches ? 'dark' : 'light';
}
function applyTheme() {
  document.documentElement.dataset.theme = resolveTheme();
}
darkQuery.addEventListener('change', () => { if ((state.prefs.theme || 'auto') === 'auto') applyTheme(); });

/* ---------------- 渲染 ---------------- */
function render() {
  const dot = $('#sync-dot');
  if (dot) {
    dot.className = 'sync-dot ' + (!state.prefs.token ? 'off' : syncState === 'error' ? 'err' : syncState === 'syncing' ? 'busy' : 'ok');
    dot.title = !state.prefs.token ? '未连接云端' : syncState === 'error' ? '同步失败' : syncState === 'syncing' ? '同步中' : '已同步';
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  document.querySelectorAll('.segmented button[data-subject]').forEach((b) => b.classList.toggle('on', b.dataset.subject === subject));
  $('#app').innerHTML = view === 'today' ? todayView() : view === 'calendar' ? calendarView() : view === 'stats' ? statsView() : meView();
  const app = $('#app');
  app.classList.remove('enter');
  void app.offsetWidth;
  app.classList.add('enter');
  animateRing();
}

function animateRing() {
  const ring = document.querySelector('.ring');
  if (!ring) return;
  const target = ring.style.getPropertyValue('--p') || '0';
  ring.style.setProperty('--p', '0');
  requestAnimationFrame(() => requestAnimationFrame(() => ring.style.setProperty('--p', target)));
}

function todayView() {
  const list = ofDate(selected);
  const done = list.filter((t) => t.done).length;
  const remain = sum(list.filter(openTask), 'minutes');
  const total = sum(list, 'minutes');
  const isToday = selected === today();
  const p = progress();
  const doneMin = sum(list.filter((t) => t.done), 'minutes');
  const pct = total ? Math.round(doneMin / total * 100) : 0;
  const head = `<section class="topdate">
    <button class="chev" data-action="day" data-n="-1" aria-label="前一天"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg></button>
    <div><b>${isToday ? '今天' : weekday(selected)}</b><span>${selected.replace(/-/g, '.')}</span></div>
    <button class="chev" data-action="day" data-n="1" aria-label="后一天"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6"/></svg></button>
  </section>`;
  const focus = `<section class="focus">
    <div class="ring" style="--p:${pct}"><div class="ring-in"><b>${remain}</b><small>分钟待做</small></div></div>
    <div class="focus-list">
      <div><span>未完成</span><b>${list.length - done}</b></div>
      <div><span>已完成</span><b>${done}</b></div>
      <div><span>计划分钟</span><b>${total}</b></div>
    </div>
  </section>`;
  const hint = isToday && p.days >= 3
    ? `<p class="hint-line">距考试 ${p.days} 天 · 每天 ${p.required} 分钟${p.behind ? ' · 落后' : ''}</p>`
    : '';
  const review = lastReport && isToday && lastReport.date === today() && lastReport.fixes.length
    ? `<section class="review">
        <header><b>已整理 ${lastReport.fixes.length} 项</b><button data-action="dismiss-review">知道了</button></header>
        ${lastReport.fixes.slice(0, 3).map((f) => `<p>「${esc(f.title)}」 ${f.from.slice(5)} → ${f.to.slice(5)}</p>`).join('')}
        ${lastReport.fixes.length > 3 ? `<p class="more">…等 ${lastReport.fixes.length} 项</p>` : ''}
        <button class="ghost small" data-action="undo">撤销这次整理</button>
      </section>` : '';
  const name = subject === 'english' ? '英语二' : '政治';
  const total0 = live().filter(mine).length;
  const empty = total0 === 0
    ? `<section class="empty"><b>「${name}」还没有任务</b><p>先导入这个科目的计划。</p><button class="cta" data-action="add">添加任务</button></section>`
    : `<section class="empty"><b>这一天还没有任务</b><p>导入计划或添加一条。</p><button class="cta" data-action="add">添加任务</button></section>`;
  const body = list.length
    ? `<section class="group"><h2>${isToday ? '今日任务' : '当天任务'} <em>${list.length}</em></h2><ul class="tasks">${list.map(row).join('')}</ul></section>`
    : empty;
  return head + focus + hint + review + body;
}

function row(t) {
  const cls = t.done ? ' done' : t.notDone ? ' skipped' : '';
  return `<li class="task${cls}">
    <button class="tick" data-action="toggle" data-id="${t.id}" aria-label="切换完成">${t.done ? '✓' : ''}</button>
    <button class="task-main" data-action="edit" data-id="${t.id}">
      <b>${esc(t.title)}</b>
      <span class="meta">${esc(t.type)}${typeof t.score === 'number' ? ' · 得分 ' + t.score + '/' + (t.scoreMax || 10) : ''}${t.actualMinutes ? ' · 实际 ' + t.actualMinutes + ' 分' : ''}${t.notDone ? ' · 不做' : ''}</span>
    </button>
    <span class="mins">${t.minutes}<small>分</small></span>
  </li>`;
}

function calendarView() {
  const [year, month] = calMonth.split('-').map(Number);
  const first = new Date(year, month - 1, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="cal-day dim"></span>');
  for (let d = 1; d <= days; d++) {
    const date = `${calMonth}-${String(d).padStart(2, '0')}`;
    const list = ofDate(date);
    const done = list.filter((t) => t.done).length;
    const cls = ['cal-day'];
    if (date === today()) cls.push('today');
    if (date === selected) cls.push('sel');
    if (list.length) cls.push(done === list.length ? 'full' : 'has');
    cells.push(`<button class="${cls.join(' ')}" data-action="pick" data-date="${date}">
      <span>${d}</span>${list.length ? `<i class="${done === list.length ? 'ok' : ''}"></i>` : ''}</button>`);
  }
  const list = ofDate(selected);
  return `<section class="cal">
    <header><button data-action="month" data-n="-1" aria-label="上个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg></button><b>${year} 年 ${month} 月</b><button data-action="month" data-n="1" aria-label="下个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6"/></svg></button></header>
    <div class="cal-week">${['一','二','三','四','五','六','日'].map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
  </section>
  <h3 class="sec">${selected.replace(/-/g, '.')} ${weekday(selected)}</h3>
  ${list.length ? `<ul class="tasks">${list.map(row).join('')}</ul>` : '<p class="note center">这天没有安排</p>'}
  <button class="ghost wide" data-action="add">在这天添加</button>`;
}


function weeklyReview() {
  const start = shift(today(), -6);
  const s = rangeStats(start, today());
  const p = progress();
  const byType = {};
  for (const t of s.list) {
    const k = t.type || '其他';
    byType[k] = byType[k] || { total: 0, done: 0 };
    byType[k].total++;
    if (t.done) byType[k].done++;
  }
  const weakest = Object.entries(byType)
    .filter(([, v]) => v.total >= 2)
    .sort((a, b) => a[1].done / a[1].total - b[1].done / b[1].total)[0];
  const lines = ['近 7 天：完成 ' + s.done.length + '/' + s.list.length + ' 项，实际 ' +
    s.actualMinutes + ' 分钟，计划 ' + s.planMinutes + ' 分钟。'];
  if (!s.list.length) lines.push('这周还没有安排，先去导入一份计划。');
  else if (s.rate >= 80) lines.push('完成率不错，保持现在的节奏，不要额外加量。');
  else if (s.rate >= 50) lines.push('完成率一般，优先保住每天必做的那几项，其余可以往后挪。');
  else lines.push('完成率偏低，先减少每天任务数量，否则容易整天空转。');
  if (weakest) lines.push('最弱的是「' + weakest[0] + '」（' + weakest[1].done + '/' + weakest[1].total + '），下周先补它。');
  if (p.days > 0) {
    lines.push(p.behind
      ? '按剩余 ' + p.remain + ' 分钟 / ' + p.days + ' 天算，每天需要 ' + p.required + ' 分钟，目前平均 ' + p.actual + ' 分钟，落后。'
      : '每天应做 ' + p.required + ' 分钟，近 7 天平均 ' + p.actual + ' 分钟，节奏正常。');
  }
  return lines.join('\n');
}


/* ---------------- 统计工具 ---------------- */
const EXAM_SHAPE = [['完', '完形'], ['阅', '阅读'], ['新', '新题型'], ['译', '翻译'], ['小', '小作文'], ['大', '大作文']];

function kindOf(t) {
  if (t.type === '写作') return /小作文|应用文|书信|通知|告示/.test(t.title) ? '小' : '大';
  if (t.type === '阅读') return '阅';
  if (t.type === '完形') return '完';
  if (t.type === '新题型') return '新';
  if (t.type === '翻译') return '译';
  return '';
}

function englishMatrix() {
  const rows = [];
  for (let y = 2010; y <= 2023; y++) {
    const list = live().filter((t) => t.subject === 'english' && String(t.title).includes(String(y)));
    const cells = {};
    for (const [k] of EXAM_SHAPE) cells[k] = { plan: 0, done: 0, rec: 0 };
    for (const t of list) {
      const k = kindOf(t);
      if (!cells[k]) continue;
      if (!t.date) { cells[k].rec = 1; continue; }
      cells[k].plan++;
      if (t.done) cells[k].done++;
    }
    // 无日期记录 = 至少做过一次
    for (const k of Object.keys(cells)) {
      if (cells[k].rec) {
        cells[k].plan = Math.max(cells[k].plan, 1);
        cells[k].done = Math.max(cells[k].done, 1);
      }
    }
    const scored = list.filter((t) => typeof t.score === 'number');
    rows.push({ y, cells, total: list.length,
      avg: scored.length ? scored.reduce((a, t) => a + t.score, 0) / scored.length : null });
  }
  return rows;
}

function englishTypes() {
  const map = new Map();
  for (const t of live().filter((x) => x.subject === 'english')) {
    const k = kindOf(t) || t.type;
    if (!map.has(k)) map.set(k, { k, plan: 0, done: 0, scored: [] });
    const row = map.get(k);
    row.plan++;
    if (t.done) row.done++;
    if (typeof t.score === 'number') row.scored.push(t.score);
  }
  const order = ['阅', '完', '新', '译', '小', '大'];
  return [...map.values()].sort((a, b) => {
    const ia = order.indexOf(a.k), ib = order.indexOf(b.k);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function moduleOf(title) {
  const s = String(title);
  if (/马原|唯物|辩证法|认识论|政治经济学|科学社会主义/.test(s)) return '马原';
  if (/毛中特|毛泽东|新民主主义|社会主义改造|改革开放/.test(s)) return '毛中特';
  if (/史纲|近代史|党史/.test(s)) return '史纲';
  if (/思修|道德|法治/.test(s)) return '思修';
  if (/习思想|习近平|新时代|中国式现代化|总论|新思想/.test(s)) return '新思想';
  if (/时政|形势与政策/.test(s)) return '新思想';
  return '';
}

function politicsStats() {
  const list = live().filter((t) => t.subject === 'politics');
  const courses = list.filter((t) => t.type === '课程');
  const drills = list.filter((t) => t.type === '刷题');
  const group = (items) => {
    const map = new Map();
    for (const t of items) {
      const m = moduleOf(t.title) || '其他';
      if (!map.has(m)) map.set(m, { m, plan: 0, done: 0 });
      const row = map.get(m);
      row.plan++;
      if (t.done) row.done++;
    }
    return [...map.values()].sort((a, b) => b.plan - a.plan);
  };
  const daily = [...Array(7)].map((_, i) => {
    const d = shift(today(), i - 6);
    return { d, done: drills.filter((t) => t.date === d && t.done).length };
  });
  return {
    courses: group(courses),
    drills: group(drills),
    coursePlan: courses.length,
    courseDone: courses.filter((t) => t.done).length,
    drillPlan: drills.length,
    drillDone: drills.filter((t) => t.done).length,
    daily
  };
}


const KIND_NAME = { 完: '完形', 阅: '阅读', 新: '新题型', 译: '翻译', 小: '小作文', 大: '大作文' };
const KIND_TYPE = { 完: '完形', 阅: '阅读', 新: '新题型', 译: '翻译', 小: '写作', 大: '写作' };


/* ---------------- 历史记录（无日期） ---------------- */
const RECORD_KINDS = ['完形', '阅读', '新题型', '翻译', '小作文', '大作文'];
const RECORD_TYPE = { 完形: '完形', 阅读: '阅读', 新题型: '新题型', 翻译: '翻译', 小作文: '写作', 大作文: '写作' };

function parseRecords(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const year = (raw.match(/\b(20\d{2})\b/) || [])[1];
    if (!year) continue;
    const kind = RECORD_KINDS.find((k) => raw.includes(k));
    if (!kind) continue;
    const rest = raw.replace(year, '').replace(kind, '');
    const score = (rest.match(/(\d{1,2}(?:\.\d)?)/) || [])[1];
    out.push({
      id: uid(), subject: 'english', date: '', title: year + ' ' + kind,
      type: RECORD_TYPE[kind], minutes: 0, done: true, notDone: false,
      score: score === undefined ? null : Number(score), scoreMax: 10,
      note: '补录', updatedAt: Date.now()
    });
  }
  return out;
}

function recordPrompt() {
  return [
    '请根据我做过的英语二真题，输出下面格式的表格，只输出表格，不要任何解释：',
    '',
    '| 年份 | 题型 | 得分 |',
    '| --- | --- | --- |',
    '| 2015 | 阅读 | 8 |',
    '| 2015 | 完形 |  |',
    '',
    '要求：',
    '1. 年份范围 2010–2023。',
    '2. 题型只能填：完形、阅读、新题型、翻译、小作文、大作文。',
    '3. 得分填 0–10，忘了或没做就留空；整行不要出现没做过的。',
    '4. 我写过的才列出，一行代表该年该题型做过一次。',
    '',
    '我的情况：（在这里补充：哪几年做过、大概得分、哪些还没做）'
  ].join(String.fromCharCode(10));
}

function openYear(year, kind) {
  const list = live()
    .filter((t) => t.subject === 'english' && String(t.title).includes(String(year)) && (!kind || kindOf(t) === kind))
    .sort((a, b) => a.title.localeCompare(b.title));
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="sheet">
    <header><h2>${year} 年${kind ? ' · ' + KIND_NAME[kind] : ''}</h2><button data-action="close">×</button></header>
    ${list.length ? list.map((t) => `<div class="yt-row">
        <span>${esc(t.title)}</span>
        <em class="${t.done ? 'ok' : ''}">${!t.date ? '记录' : t.done ? '已完成' : '未完成'}${typeof t.score === 'number' ? ' · ' + t.score + ' 分' : ''}</em>
      </div>`).join('') : '<p class="note">这一年还没有安排</p>'}
    <button class="ghost wide" data-action="year-add" data-year="${year}" data-kind="${kind || ''}">添加${kind ? KIND_NAME[kind] : ''}任务</button>
  </div>`;
}

function matrixCell(c) {
  if (!c.plan) return '<i class="none">·</i>';
  if (c.done >= c.plan) return `<i class="ok">${c.plan}</i>`;
  if (c.done) return `<i class="part">${c.done}/${c.plan}</i>`;
  return `<i class="plan">${c.plan}</i>`;
}

function englishStats() {
  const start = shift(today(), -6);
  const week = rangeStats(start, today());
  const days = [...Array(7)].map((_, i) => {
    const d = shift(today(), i - 6);
    return { d, minutes: rangeStats(d, d).actualMinutes };
  });
  const peak = Math.max(60, ...days.map((x) => x.minutes));
  const rows = englishMatrix();
  const covered = rows.filter((r) => r.total);
  const scored = live().filter((t) => t.subject === 'english' && typeof t.score === 'number');
  const avg = scored.length ? (scored.reduce((a, t) => a + t.score, 0) / scored.length).toFixed(1) : null;
  const types = englishTypes();
  const total = live().filter((t) => t.subject === 'english').length;
  return `<section class="stat-row">
      <div class="stat"><b>${week.done.length}<small>/${week.list.length}</small></b><span>近 7 天完成</span></div>
      <div class="stat"><b>${week.actualMinutes}</b><span>实际分钟</span></div>
      <div class="stat"><b>${week.rate}<small>%</small></b><span>完成率</span></div>
    </section>
    <section class="card">
      <h2>近 7 天</h2>
      <div class="bars">${days.map((x) => `<div class="col"><i style="height:${Math.max(3, Math.round(x.minutes / peak * 84))}px" class="${x.minutes ? 'on' : ''}"></i><span>${x.d.slice(8)}</span></div>`).join('')}</div>
    </section>
    <section class="card">
      <h2>真题覆盖</h2>
      <p class="meta-line">${covered.length ? covered[0].y + '–' + covered[covered.length - 1].y : '—'} · ${total} 项 · ${avg ? '二刷均分 ' + avg : '无分数'}</p>
      <div class="matrix">
        <div class="mhead"><span>年份</span>${EXAM_SHAPE.map(([k]) => `<i>${k}</i>`).join('')}</div>
        ${rows.map((r) => `<div class="mrow${r.total ? '' : ' off'}">
          <button class="myear" data-action="year" data-year="${r.y}">${r.y}</button>
          ${EXAM_SHAPE.map(([k]) => `<button class="mcell" data-action="year" data-year="${r.y}" data-kind="${k}" aria-label="${r.y} 年 ${KIND_NAME[k]}">${matrixCell(r.cells[k])}</button>`).join('')}
        </div>`).join('')}
      </div>
      <div class="chips" style="margin-top:10px">
        <button data-action="backfill">手动补录</button>
        <button data-action="import-records">粘贴补录</button>
        <button data-action="record-prompt">复制提示词</button>
      </div>
    </section>
    <section class="card">
      <h2>题型合计</h2>
      ${types.map((t) => `<div class="type-row">
        <span>${t.k}</span><b>${t.done}/${t.plan}</b>
        <i><u style="width:${t.plan ? Math.round(t.done / t.plan * 100) : 0}%"></u></i>
        <em>${t.scored.length ? '均 ' + (t.scored.reduce((a, b) => a + b, 0) / t.scored.length).toFixed(1) : Math.round(t.plan ? t.done / t.plan * 100 : 0) + '%'}</em>
      </div>`).join('') || '<p class="note">暂无任务</p>'}
    </section>`;
}

function politicsStatsView() {
  const s = politicsStats();
  const peak = Math.max(1, ...s.daily.map((x) => x.done));
  const row = (r, label) => {
    const pct = r.plan ? Math.round((r.done / r.plan) * 100) : 0;
    return `<div class="type-row">
      <span>${r.m}</span><b>${r.done}/${r.plan}</b>
      <i><u style="width:${pct}%"></u></i>
      <em>${pct}%</em>
    </div>`;
  };
  return `<section class="stat-row">
      <div class="stat"><b>${s.courseDone}<small>/${s.coursePlan}</small></b><span>强化课</span></div>
      <div class="stat"><b>${s.drillDone}<small>/${s.drillPlan}</small></b><span>刷题</span></div>
      <div class="stat"><b>${s.daily.reduce((a, x) => a + x.done, 0)}</b><span>近 7 天</span></div>
    </section>
    <section class="card">
      <h2>强化课</h2>
      ${s.courses.map((r) => row(r)).join('') || '<p class="note">计划里还没有课程</p>'}
    </section>
    <section class="card">
      <h2>刷题</h2>
      ${s.drills.map((r) => row(r)).join('') || '<p class="note">计划里还没有刷题</p>'}
    </section>
    <section class="card">
      <h2>每天刷题</h2>
      <div class="bars">${s.daily.map((x) => `<div class="col"><i style="height:${Math.max(3, Math.round(x.done / peak * 84))}px" class="${x.done ? 'on' : ''}"></i><span>${x.d.slice(8)}</span></div>`).join('')}</div>
    </section>`;
}

function statsFooter() {
  return `<section class="card">
      <h2>本周复盘</h2>
      <p class="line">${weeklyReview().split(String.fromCharCode(10)).map(esc).join('<br>')}</p>
      <div class="chips" style="margin-top:10px">
        <button data-action="copy-review">复制复盘</button>
        <button data-action="copy" data-scope="day">今天</button>
        <button data-action="copy" data-scope="week">近 7 天</button>
        <button data-action="copy" data-scope="all">全部</button>
      </div>
    </section>`;
}

function statsView() {
  return (subject === 'english' ? englishStats() : politicsStatsView()) + statsFooter();
}

function meView() {
  const p = progress();
  const status = state.prefs.token
    ? (syncState === 'error' ? '同步失败，稍后重试' : syncState === 'syncing' ? '同步中…' : `已连接 · 版本 ${state.rev}`)
    : '未连接';
  const theme = state.prefs.theme || 'auto';
  return `<section class="card">
      <h2>外观</h2>
      <div class="segmented wide-seg" role="tablist">
        <button data-theme-choice="auto" class="${theme === 'auto' ? 'on' : ''}">跟随系统</button>
        <button data-theme-choice="light" class="${theme === 'light' ? 'on' : ''}">白天</button>
        <button data-theme-choice="dark" class="${theme === 'dark' ? 'on' : ''}">夜间</button>
      </div>
    </section>
    <section class="card">
      <h2>云同步</h2>
      <div class="row"><span>状态</span><em>${status}</em></div>
      <label class="field"><span>同步密码</span><input id="pref-token" type="password" value="${esc(state.prefs.token)}" placeholder="部署时生成，只需填一次"></label>
      <p class="note">只需填一次。</p>
      <button class="cta" data-action="save-prefs">保存并同步</button>
    </section>
    <section class="card">
      <h2>考试</h2>
      <div class="row"><span>初试日期</span><em>2026 年 12 月 19 日</em></div>
      <div class="row"><span>倒计时</span><em>${p.days} 天</em></div>
    </section>
    <section class="card">
      <h2>每日整理</h2>
      <label class="check-line"><input type="checkbox" id="pref-review"${state.prefs.autoReview ? ' checked' : ''}> 每天打开时自动整理</label>
      <button class="ghost wide" data-action="review-now">立即整理一次</button>
    </section>
    <section class="card">
      <h2>计划</h2>
      <button class="ghost wide" data-action="import">导入计划</button>
      <button class="ghost wide" data-action="prompt">复制导入提示词</button>
      <button class="ghost wide" data-action="reclassify">按内容重新分科</button>
      <button class="ghost wide" data-action="export">导出全部</button>
      <button class="ghost wide" data-action="clear">清空当前科目</button>
    </section>
    <section class="card">
      <h2>数据</h2>
      <div class="row"><span>英语 / 政治</span><em>${countBySubject()}</em></div>
      <div class="row"><span>本科目待做</span><em>${p.count} 项 · ${p.remain} 分钟</em></div>
      <div class="row"><span>每天应做</span><em>${p.required} 分钟</em></div>
    </section>
    <section class="card">
      <h2>版本</h2>
      <div class="row"><span>当前</span><em>${esc(APP_VERSION || '本地预览')}</em></div>
      <button class="ghost wide" data-action="check-update">检查更新</button>
    </section>`;
}

/* ---------------- 编辑 ---------------- */
function openSheet(t) {
  const isNew = !t.id;
  const draft = isNew ? { date: selected, title: '', type: '阅读', minutes: 30, note: '' } : t;
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="sheet">
    <header><h2>${isNew ? '添加任务' : '编辑任务'}</h2><button data-action="close">×</button></header>
    <label class="field"><span>内容</span><input id="f-title" value="${esc(draft.title)}" maxlength="200"></label>
    <div class="two">
      <label class="field"><span>日期（留空 = 历史记录）</span><input id="f-date" type="date" value="${draft.date || ''}"></label>
      <label class="field"><span>计划分钟</span><input id="f-minutes" type="number" min="5" max="300" value="${draft.minutes}"></label>
    </div>
    <label class="field"><span>类型</span><select id="f-type">${TYPES.map((x) => `<option${x === draft.type ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
    <div class="two">
      <label class="field"><span>得分（可选）</span><input id="f-score" type="number" step="0.5" min="0" max="100" value="${typeof draft.score === 'number' ? draft.score : ''}" placeholder="如 8"></label>
      <label class="field"><span>满分</span><input id="f-scoremax" type="number" step="1" min="1" max="100" value="${draft.scoreMax || 10}"></label>
    </div>
    <label class="field"><span>实际用时（分钟，可选）</span><input id="f-actual" type="number" min="0" max="600" value="${draft.actualMinutes ?? ''}"></label>
    <label class="field"><span>备注（可选）</span><textarea id="f-note" rows="2">${esc(draft.note || '')}</textarea></label>
    <div class="row-btns">
      <button class="ghost" data-action="skip" data-id="${draft.id || ''}">${draft.notDone ? '恢复待做' : '标记不做'}</button>
      ${isNew ? '' : `<button class="danger" data-action="del" data-id="${draft.id}">删除</button>`}
    </div>
    <button class="cta wide" data-action="save-task" data-id="${draft.id || ''}">保存</button>
  </div>`;
}
function closeSheet() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }


/* ---------------- 科目识别 ---------------- */
const POLITICS_KW = /马原|毛中特|毛概|史纲|思修|时政|政治|肖秀荣|徐涛|腿姐|一千题|1000题|800题|精讲精练|背诵手册|选择题|大题/;
const ENGLISH_KW = /阅读|翻译|写作|完形|新题型|单词|真题|Text|长难句|作文|模板|黄皮书|恋练有词|英语/;
function guessSubject(text) {
  const s = String(text || '');
  const p = POLITICS_KW.test(s), e = ENGLISH_KW.test(s);
  if (p && !e) return 'politics';
  if (e && !p) return 'english';
  return '';
}
function subjectFor(cells, title) {
  const cell = (cells || []).find((c) => /^(英语|英语二|政治)$/.test(c));
  if (cell) return /政治/.test(cell) ? 'politics' : 'english';
  return guessSubject(title) || subject;
}
function countBySubject() {
  const live0 = live();
  const en = live0.filter((t) => t.subject === 'english').length;
  const po = live0.filter((t) => t.subject === 'politics').length;
  return en + ' / ' + po;
}

/* ---------------- 导入导出 ---------------- */
const DATE_RE = /(\d{4})-(\d{2})-(\d{2})/;
function normalizeDate(text) {
  const m = String(text || '').match(DATE_RE);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const m2 = String(text || '').match(/(\d{1,2})[月\/.-](\d{1,2})/);
  if (m2) return `${today().slice(0, 4)}-${String(m2[1]).padStart(2, '0')}-${String(m2[2]).padStart(2, '0')}`;
  return today();
}
function parsePlan(text) {
  const body = String(text || '').trim();
  if (!body) return [];
  if (body.startsWith('[') || body.startsWith('{')) {
    const data = JSON.parse(body);
    const list = Array.isArray(data) ? data : data.tasks || data.plan || [];
    return list.map((x) => ({ id: x.id || uid(), subject: x.subject || subject, date: normalizeDate(x.date),
      title: String(x.title || '任务'), type: TYPES.includes(x.type) ? x.type : '其他',
      minutes: Number(x.minutes) || 30, done: !!x.done, notDone: !!x.notDone,
      note: x.note || '', actualMinutes: x.actualMinutes ?? null, updatedAt: Date.now() }));
  }
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || /^[-|:\s]+$/.test(raw)) continue;
    if (raw.includes('|')) {
      if (/日期/.test(raw) && /任务/.test(raw)) continue;
      const cells = raw.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.length < 2) continue;
      const date = normalizeDate(cells.find((c) => DATE_RE.test(c)) || cells[0]);
      const typeCell = cells.find((c) => TYPES.includes(c));
      const nums = cells.filter((c) => /^\d{1,3}$/.test(c));
      const title = cells.find((c) => c && !DATE_RE.test(c) && !/^\d+$/.test(c) && c !== typeCell) || '任务';
      out.push({ id: uid(), subject: subjectFor(cells, title), date, title, type: typeCell || '阅读',
        minutes: Number(nums.length ? nums[nums.length - 1] : 30), done: false, notDone: false,
        note: '', actualMinutes: null, updatedAt: Date.now() });
      continue;
    }
    const date = normalizeDate(raw);
    const cleaned = raw.replace(/^[-*•\d.、)\s]+/, '');
    const mins = (cleaned.match(/(\d{1,3})\s*(分钟|min)/i) || [])[1];
    const title = cleaned.replace(/\s*\d{1,3}\s*(分钟|min).*$/i, '').replace(DATE_RE, '').replace(/^\d{1,2}[月\/.-]\d{1,2}\s*/, '').trim();
    if (!title) continue;
    out.push({ id: uid(), subject: subjectFor([], title), date, title, type: TYPES.find((k) => title.includes(k)) || '阅读',
      minutes: Number(mins) || 30, done: false, notDone: false, note: '', actualMinutes: null, updatedAt: Date.now() });
  }
  return out;
}

function openImport(preset) {
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="sheet">
    <header><h2>导入计划</h2><button data-action="close">×</button></header>
    <p class="note">表格、每行一条或 JSON。</p>
    <textarea id="import-text" rows="8" placeholder="| 2026-10-21 | 阅读真题 2021 T1 | 阅读 | 40 |&#10;2026-10-22 翻译 长难句 30分钟"></textarea>
    <div class="modes">
      <label><input type="radio" name="import-mode" value="range"${preset === 'range' || !preset ? ' checked' : ''}><span><b>按日期覆盖</b><em>替换导入日期内的安排，保留已完成与不做</em></span></label>
      <label><input type="radio" name="import-mode" value="merge"><span><b>只添加</b><em>相同日期和内容的任务跳过</em></span></label>
      <label><input type="radio" name="import-mode" value="all"><span><b>全部替换</b><em>清空当前科目后导入</em></span></label>
      <label><input type="radio" name="import-mode" value="records"${preset === 'records' ? ' checked' : ''}><span><b>补录记录</b><em>只有年份、没有日期，只进统计</em></span></label>
    </div>
    <button class="cta wide" data-action="import-run">导入</button>
  </div>`;
}

function promptText() {
  const start = today();
  return `请帮我排一份考研学习计划，只输出 Markdown 表格，不要解释、不要额外文字。

表格格式：
| 日期 | 任务 | 类型 | 分钟 |
| --- | --- | --- | --- |
| ${start} | 示例：阅读真题 2021 Text 1 | 阅读 | 40 |

要求：
1. 日期用 YYYY-MM-DD，从 ${start} 开始，按天递增，不要排到考试之后。
2. 类型只能从：${TYPES.join('、')} 中选。
3. 每项 15-120 分钟；每天总时长不超过 150 分钟；每 7 天留 1 天休息。
4. 任务名具体到材料，例如「阅读真题 2021 Text 1」「马原 第 3 章 刷题 30 题」。
5. 我的情况：（在这里补充：目标院校/专业、考试日期、每天可用时间、薄弱科目、已做过的真题）。`;
}

function copyText(text, label) {
  const done = () => toast(label + ' 已复制');
  const fallback = () => {
    $('#modal').hidden = false;
    $('#modal').innerHTML = `<div class="sheet"><header><h2>${label}</h2><button data-action="close">×</button></header><textarea rows="14">${esc(text)}</textarea></div>`;
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
  else fallback();
}

function gptText(scope) {
  const name = subject === 'english' ? '英语二' : '政治';
  const from = scope === 'day' ? selected : scope === 'week' ? shift(today(), -6) : '';
  const to = scope === 'day' ? selected : today();
  const list = live().filter((t) => mine(t) && t.date >= (from || '0000-00-00') && t.date <= (scope === 'all' ? '9999-99-99' : to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const lines = [`【${name}】${from ? from + ' ~ ' + to : '全部'}`];
  let last = '';
  for (const t of list) {
    const mark = t.done ? '✅' : t.notDone ? '❌' : '⭕';
    const actual = t.actualMinutes ? `（实际 ${t.actualMinutes} 分钟）` : '';
    if (t.date !== last) { lines.push(t.date ? `${t.date} ${weekday(t.date)}` : '历史记录（无日期）'); last = t.date; }
    const mins = t.minutes ? ` ${t.minutes} 分钟` : '';
    const score = typeof t.score === 'number' ? ` · 得分 ${t.score}/${t.scoreMax || 10}` : '';
    lines.push(`${mark} ${t.title} · ${t.type}${mins}${score}${actual}${t.note ? ' · 备注：' + t.note : ''}`);
  }
  const s = rangeStats(from || (list[0]?.date || today()), to);
  const p = progress();
  lines.push(`— 合计：完成 ${s.done.length}/${s.list.length} 项，计划 ${s.planMinutes} 分钟，实际 ${s.actualMinutes} 分钟`);
  lines.push(`— 进度：还剩 ${p.count} 项 ${p.remain} 分钟，每天应做 ${p.required} 分钟，近 7 天平均 ${p.actual} 分钟${p.behind ? '（落后）' : ''}`);
  return lines.join('\n');
}

function exportAll() {
  const list = live().filter(mine).sort((a, b) => a.date.localeCompare(b.date));
  const lines = ['| 日期 | 任务 | 类型 | 分钟 | 状态 |', '| --- | --- | --- | --- | --- |'];
  for (const t of list) lines.push(`| ${t.date} | ${t.title.replace(/\|/g, '/')} | ${t.type} | ${t.minutes} | ${t.done ? '完成' : t.notDone ? '不做' : ''} |`);
  copyText(lines.join('\n'), '全部计划');
}

/* ---------------- 同步 ---------------- */
function httpError(status, payload) { const e = new Error(payload?.detail || 'HTTP ' + status); e.status = status; e.payload = payload; return e; }
async function api(path, options = {}) {
  const base = (state.prefs.apiBase || '').replace(/\/+$/, '');
  if (!base) throw new Error('未配置接口地址');
  if (!state.prefs.token) throw new Error('未配置口令');
  const res = await fetch(base + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + state.prefs.token, ...(options.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(res.status, data);
  return data;
}
function mergeTasks(local, remote) {
  const map = new Map();
  for (const t of [...remote, ...local]) {
    const prev = map.get(t.id);
    if (!prev || (t.updatedAt || 0) >= (prev.updatedAt || 0)) map.set(t.id, t);
  }
  return [...map.values()];
}
let pushTimer = null;
function schedulePush() {
  if (!state.prefs.token) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { push().catch(() => {}); }, 1200);
}
async function push() {
  if (!state.prefs.token) return;
  syncState = 'syncing';
  try {
    const r = await api('/plan', { method: 'PUT', body: JSON.stringify({ expectedRevision: state.rev, tasks: state.tasks }) });
    state.rev = r.revision; state.dirty = false; save(); syncState = 'ok';
    if (view === 'me') render();
  } catch (err) {
    if (err.status === 409 && err.payload?.tasks) {
      state.tasks = mergeTasks(state.tasks, err.payload.tasks);
      state.rev = err.payload.revision;
      save();
      toast('云端有更新，已自动合并');
      return push();
    }
    syncState = 'error';
    if (view === 'me') render();
    throw err;
  }
}
async function pull() {
  if (!state.prefs.token) return;
  syncState = 'syncing';
  try {
    const r = await api('/plan');
    if (r.revision > state.rev) {
      // 永远合并：首次连接不能把本地新建的计划冲掉
      state.tasks = mergeTasks(state.tasks, r.tasks);
      state.rev = r.revision;
      state.dirty = true;
      save();
      render();
      return push();
    } else if (state.dirty) { return push(); }
    syncState = 'ok';
    if (view === 'me') render();
  } catch { syncState = 'error'; if (view === 'me') render(); }
}

/* ---------------- 事件 ---------------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-action],[data-view],[data-subject],[data-theme-choice]');
  if (!el) { if (e.target.id === 'modal') closeSheet(); return; }
  if (el.dataset.view) { view = el.dataset.view; if (view === 'calendar') calMonth = selected.slice(0, 7); render(); return; }
  if (el.dataset.subject) { subject = el.dataset.subject; state.prefs.subject = subject; save(); render(); return; }
  if (el.dataset.themeChoice) { state.prefs.theme = el.dataset.themeChoice; save(); applyTheme(); render(); return; }
  const a = el.dataset.action;
  if (a === 'day') { selected = shift(selected, Number(el.dataset.n)); render(); return; }
  if (a === 'month') {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.n), 1, 12);
    calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render(); return;
  }
  if (a === 'pick') { selected = el.dataset.date; view = 'today'; render(); return; }
  if (a === 'toggle') {
    const t = findTask(el.dataset.id);
    if (!t || t._animating) return;
    t.done = !t.done; if (t.done) t.notDone = false;
    touch(t); save(); schedulePush();
    const card = el.closest('.task');
    if (card && t.done) {
      t._animating = true;
      card.classList.add('pop');
      setTimeout(() => { t._animating = false; render(); }, 220);
    } else {
      render();
    }
    return;
  }
  if (a === 'edit') { openSheet(findTask(el.dataset.id)); return; }
  if (a === 'add') { openSheet({ date: selected }); return; }
  if (a === 'check-update') { await checkUpdate(true); return; }
  if (a === 'record-prompt') { copyText(recordPrompt(), '补录提示词'); return; }
  if (a === 'import-records') { openImport('records'); return; }
  if (a === 'year') { openYear(Number(el.dataset.year), el.dataset.kind || ''); return; }
  if (a === 'year-add') {
    const year = el.dataset.year, kind = el.dataset.kind;
    openSheet({ date: year + '-12-01', title: year + ' ', type: KIND_TYPE[kind] || '阅读', minutes: 30 });
    return;
  }
  if (a === 'backfill') { openSheet({ date: shift(today(), -1), title: '', type: '阅读', minutes: 30 }); return; }
  if (a === 'close') { closeSheet(); return; }
  if (a === 'save-task') {
    const id = el.dataset.id, title = $('#f-title').value.trim(), date = $('#f-date').value;
    const mins = Number($('#f-minutes').value) || 30;
    const actual = $('#f-actual').value;
    if (!title) return toast('写个任务名');
    // 日期留空 = 历史记录，只进统计
    const scoreRaw = $('#f-score') ? $('#f-score').value : '';
    const scoreMaxRaw = $('#f-scoremax') ? Number($('#f-scoremax').value) : 10;
    const patch = { title, date: date || '', minutes: Math.max(5, Math.min(300, mins)), type: $('#f-type').value,
      score: scoreRaw === '' ? null : Math.max(0, Math.min(100, Number(scoreRaw))),
      scoreMax: scoreMaxRaw > 0 ? scoreMaxRaw : 10,
      actualMinutes: actual === '' ? null : Math.max(0, Math.min(600, Number(actual))), note: $('#f-note').value.trim() };
    const t = id ? findTask(id) : addTask(patch);
    if (id && t) { Object.assign(t, patch); touch(t); }
    save(); closeSheet(); render(); schedulePush(); return;
  }
  if (a === 'del') {
    const t = findTask(el.dataset.id);
    if (t) { t.deleted = true; touch(t); }
    save(); closeSheet(); render(); schedulePush(); return;
  }
  if (a === 'skip') {
    const t = findTask(el.dataset.id);
    if (t) { t.notDone = !t.notDone; if (t.notDone) t.done = false; touch(t); save(); closeSheet(); render(); schedulePush(); }
    return;
  }
  if (a === 'import') { openImport(); return; }
  if (a === 'import-run') {
    const text = $('#import-text').value;
    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'range';
    let parsed = [];
    try { parsed = mode === 'records' ? parseRecords(text) : parsePlan(text); } catch { return toast('格式无法识别'); }
    if (!parsed.length) return toast('没有识别到内容');
    pushUndo();
    let removed = 0, kept = 0, added = 0;
    if (mode === 'records') {
      const seen = new Set(live().map((t) => t.title));
      const fresh = parsed.filter((t) => !seen.has(t.title));
      state.tasks = state.tasks.concat(fresh);
      added = fresh.length;
      save(); closeSheet(); render(); schedulePush();
      toast('补录 ' + added + ' 条历史记录');
      return;
    }
    if (mode === 'range') {
      const dates = new Set(parsed.map((t) => t.date));
      for (const t of state.tasks) {
        if (t.deleted || t.subject !== subject || !dates.has(t.date)) continue;
        if (t.done || t.notDone) { kept++; continue; }
        t.deleted = true; touch(t); removed++;
      }
      state.tasks = state.tasks.concat(parsed); added = parsed.length;
    } else if (mode === 'merge') {
      const seen = new Set(live().filter(mine).map((t) => t.date + '|' + t.title));
      const fresh = parsed.filter((t) => !seen.has(t.date + '|' + t.title));
      state.tasks = state.tasks.concat(fresh); added = fresh.length;
    } else {
      for (const t of state.tasks) {
        if (!t.deleted && t.subject === subject) { t.deleted = true; touch(t); removed++; }
      }
      state.tasks = state.tasks.concat(parsed); added = parsed.length;
    }
    state.dirty = true; save(); closeSheet(); render(); schedulePush();
    toast('新增 ' + added + (removed ? ' · 删除 ' + removed : '') + (kept ? ' · 保留已完成 ' + kept : ''));
    return;
  }
  if (a === 'reclassify') {
    let changed = 0;
    for (const t of state.tasks) {
      if (t.deleted) continue;
      const s = guessSubject(t.title);
      if (s && s !== t.subject) { t.subject = s; touch(t); changed++; }
    }
    if (changed) { pushUndo(); state.dirty = true; save(); render(); schedulePush(); toast('重新分科 ' + changed + ' 项'); }
    else toast('没有需要改的任务');
    return;
  }
  if (a === 'export') { exportAll(); return; }
  if (a === 'prompt') { copyText(promptText(), '导入提示词'); return; }
  if (a === 'copy') { copyText(gptText(el.dataset.scope), '学习情况'); return; }
  if (a === 'copy-review') { copyText(weeklyReview() + '\n\n' + gptText('week'), '本周复盘'); return; }
  if (a === 'clear') {
    if (!confirm('清空「' + (subject === 'english' ? '英语二' : '政治') + '」的全部任务？云端也会同步删除。')) return;
    pushUndo();
    for (const t of state.tasks) if (t.subject === subject && !t.deleted) { t.deleted = true; touch(t); }
    state.dirty = true; save(); render(); schedulePush(); toast('已清空，可撤销');
    return;
  }
  if (a === 'save-prefs') {
    state.prefs.token = $('#pref-token').value.trim();
    if ($('#pref-review')) state.prefs.autoReview = $('#pref-review').checked;
    save();
    try { await pull(); toast('已连接云端'); } catch { toast('连接失败，检查口令'); }
    return;
  }
  if (a === 'undo') { undoLast(); schedulePush(); return; }
  if (a === 'dismiss-review') { lastReport = null; render(); return; }
  if (a === 'review-now') {
    lastReport = dailyReview(true); render();
    toast(lastReport ? '已整理 ' + lastReport.fixes.length + ' 项' : '已经很整齐，不用调整');
    return;
  }
});

function toast(message, action) {
  const el = $('#toast'); el.hidden = false; el.textContent = message;
  el.onclick = action ? () => { action(); el.hidden = true; } : null;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2800);
}

applyTheme();
const linked = takeTokenFromLink();
const reclassified = autoReclassify();
render();
if (reclassified) setTimeout(() => toast('已按内容分科 ' + reclassified + ' 项'), 400);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.update().catch(() => {});
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          toast('有新版本，点这里更新', () => location.reload());
        }
      });
    });
  }).catch(() => {});
}
pull().finally(() => {
  if (linked) toast('已连接云端');
  lastReport = dailyReview();
  if (lastReport) render();
  checkUpdate(false);
  const action = params.get('action');
  if (action === 'import') openImport(params.get('mode') || '');
  if (action === 'year') openYear(Number(params.get('year') || 2015), params.get('kind') || '');
});
let lastCheck = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  pull().catch(() => {});
  if (Date.now() - lastCheck > 300000) { lastCheck = Date.now(); checkUpdate(false); }
});
window.addEventListener('online', () => { if (state.dirty) push().catch(() => {}); });
})();
