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
  prefs: { subject: 'english', apiBase: API_BASE, token: '', autoReview: false, theme: 'auto' }
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
  .sort((a, b) => Number(!openTask(a)) - Number(!openTask(b))); // 保留导入顺序，完成/不做移到底部
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

/* ---------------- 表单自动填充 ---------------- */
function markNoAutofill(root) {
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    if (el.type === 'password') return;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('data-bwignore', 'true');
    el.setAttribute('data-lpignore', 'true');
    el.setAttribute('data-1p-ignore', 'true');
  });
}

const fillObserver = new MutationObserver(() => markNoAutofill(document));
fillObserver.observe(document.body, { childList: true, subtree: true });

/* ---------------- 版本 ---------------- */
const APP_VERSION = (window.BANYA_CONFIG || {}).version || '';

async function checkUpdate() {
  try {
    const r = await fetch('./api/version?ts=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('bad');
    const data = await r.json();
    if (data.version && APP_VERSION && data.version !== APP_VERSION) {
      toast('有新版本，点这里更新', () => forceUpdate());
      return true;
    }
    return false;
  } catch {
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
  const summary = list.length
    ? `<section class="day-summary" aria-label="当天进度">
        <div><b>${done}/${list.length} 项完成</b><span>${remain} 分钟待做</span></div>
        <div class="day-progress"><i style="width:${pct}%"></i></div>
      </section>` : '';
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
    ? `<section class="empty"><b>${name}还没有计划</b><p>先导入已有安排，再从今天开始打卡。</p><button class="cta" data-action="import">导入计划</button></section>`
    : `<section class="empty"><b>这一天没有安排</b><button class="ghost wide" data-action="add">在这天添加任务</button></section>`;
  const body = list.length
    ? `<section class="group"><h2>${isToday ? '今日任务' : '当天任务'} <em>${list.length}</em></h2><ul class="tasks">${list.map(row).join('')}</ul></section>`
    : empty;
  return head + hint + review + summary + body;
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
    cells.push(`<button class="${cls.join(' ')}" data-action="pick" data-date="${date}" aria-label="${date}">
      <span>${d}</span>${list.length ? `<i class="${done === list.length ? 'ok' : ''}"></i>` : ''}</button>`);
  }
  const list = ofDate(selected);
  const done = list.filter((t) => t.done).length;
  return `<section class="cal">
    <header><button data-action="month" data-n="-1" aria-label="上个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14.5 6-6 6 6 6"/></svg></button><b>${year} 年 ${month} 月</b><button data-action="month" data-n="1" aria-label="下个月"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9.5 6 6 6-6 6"/></svg></button></header>
    <div class="cal-week">${['一','二','三','四','五','六','日'].map((x) => `<span>${x}</span>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
  </section>
  <section class="day-panel">
    <header><b>${selected.slice(5).replace('-', ' 月 ')} 日 ${weekday(selected)}</b><span>${list.length ? done + '/' + list.length + ' 完成' : '空'}</span></header>
    ${list.length ? `<ul class="tasks">${list.map(row).join('')}</ul>` : '<p class="note">这天没有安排</p>'}
    <button class="ghost wide" data-action="add">在这天添加</button>
  </section>
  `;
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

function roundOf(t) {
  if (t.round === 2) return 2;
  if (t.round === 1) return 1;
  return /二刷/.test(String(t.title)) ? 2 : 1;
}

function isRedo(t) {
  return /错题|重做|重刷|重译|重写|复盘|二遍|再刷|回顾/.test(String(t.title));
}

function englishPool() {
  const all = live().filter((t) => t.subject === 'english' && !isRedo(t));
  return all.filter((t) => {
    if (!t.date) return true;
    const second = /二刷/.test(String(t.title));
    return kindOf(t) === '阅' ? second : !second;
  });
}

function englishMatrix() {
  const rows = [];
  for (let y = 2010; y <= 2023; y++) {
    const list = englishPool().filter((t) => String(t.title).includes(String(y)));
    const cells = {};
    for (const [k] of EXAM_SHAPE) cells[k] = { plan: 0, done: 0, rec: null, scores: [] };
    for (const t of list) {
      const k = kindOf(t);
      if (!cells[k]) continue;
      if (!t.date) {
        if (!cells[k].rec || (t.score ?? -1) > (cells[k].rec.score ?? -1)) cells[k].rec = t;
        continue;
      }
      cells[k].plan++;
      if (t.done) cells[k].done++;
      if (typeof t.score === 'number') cells[k].scores.push(t.score / (t.scoreMax || 10));
    }
    // 阅读：按 Text 1–4 拆开
    const readCell = cells['阅'];
    const texts = [null, null, null, null];
    for (const t of list) {
      const m = String(t.title).match(/text\s*([1-4])/i);
      if (!m || kindOf(t) !== '阅') continue;
      texts[Number(m[1]) - 1] = t;
    }
    if (!texts.some(Boolean) && readCell && readCell.rec) texts.fill(readCell.rec);
    if (readCell) readCell.texts = texts;
    rows.push({ y, cells, total: list.length });
  }
  return rows;
}

function scoreRate(t) {
  if (typeof t.score !== 'number') return null;
  return Math.max(0, Math.min(1, t.score / (t.scoreMax || 10)));
}

function fmt1(n) {
  return (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '');
}

function rateClass(rate) {
  if (rate == null) return '';
  return rate >= 0.8 ? 'good' : rate >= 0.6 ? 'mid' : 'low';
}

function yearKey(t) {
  const y = (String(t.title).match(/20\d{2}/) || [])[0];
  if (!y) return 'x' + t.id;
  if (kindOf(t) === '阅') {
    const m = String(t.title).match(/text\s*([1-4])/i);
    return y + '-T' + (m ? m[1] : 'x');
  }
  return y;
}

function englishTypes() {
  const map = new Map();
  for (const t of englishPool()) {
    const k = kindOf(t);
    if (!k) continue;
    if (!map.has(k)) map.set(k, { k, plan: new Set(), done: new Set(), scored: [] });
    const row = map.get(k);
    const key = yearKey(t);
    row.plan.add(key);
    if (t.done) row.done.add(key);
    const r = scoreRate(t);
    if (r != null) row.scored.push({ rate: r });
  }
  const order = ['阅', '完', '新', '译', '小', '大'];
  return [...map.values()]
    .map((r) => ({ k: r.k, plan: r.plan.size, done: r.done.size, scored: r.scored }))
    .sort((a, b) => {
      const ia = order.indexOf(a.k), ib = order.indexOf(b.k);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
}

// 政治标题有两种写法：模块全称，以及肖1000 的「马2/毛1/习4/史3/思2」简写。
// 只认全称会让一大半刷题落进「其他」，所以按模块逐个匹配，先到先得。
const POLITICS_MODULES = [
  ['马原', /马原|马\d|唯物|辩证法|认识论|政治经济学|科学社会主义|对立统一|否定之否定|量变质变|真理|剩余价值|资本主义|价值规律|商品二因素|劳动二重性|资本积累|资本循环|平均利润|经济危机|生产力|生产关系|社会存在|人民群众|历史人物/],
  ['毛中特', /毛中特|毛概|毛\d|毛泽东|新民主主义|社会主义改造|改革开放理论|社会主义建设道路|社会主义初级阶段|中国特色社会主义理论/],
  ['史纲', /史纲|史\d|近代史|党史|近代中国|辛亥革命|建党|革命道路|抗日战争|解放战争|社会主义建设|改革开放历史|新中国成立|五四|长征|遵义|延安/],
  ['思修', /思修|思\d|道德|法治|理想信念|中国精神|价值观|人生|社会公德|职业道德|家庭美德/],
  ['新思想', /习思想|习\d|习近平|新时代|中国式现代化|总论|新思想|全过程人民民主|国家安全|党的建设|文化与民生|高质量发展|全面深化改革|文化强国|民生/],
  ['时政', /时政|形势与政策|肖八|肖四|模拟/]
];
function moduleOf(title) {
  const s = String(title);
  for (const [name, re] of POLITICS_MODULES) if (re.test(s)) return name;
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

function parseRecords(text, round) {
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
      note: '补录', round: round === 1 ? 1 : 2, updatedAt: Date.now()
    });
  }
  return out;
}

function openYear(year, kind) {
  const list = live()
    .filter((t) => !isRedo(t) && t.subject === 'english' && String(t.title).includes(String(year)) && (!kind || kindOf(t) === kind))
    .sort((a, b) => a.title.localeCompare(b.title));
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="sheet">
    <header><h2>${year} 年${kind ? ' · ' + KIND_NAME[kind] : ''}</h2><button data-action="close">×</button></header>
    ${list.length ? list.map((t) => `<div class="yt-row">
        <button class="yt-main" data-action="edit" data-id="${t.id}">
          <span>${esc(t.title)}</span>
          <em class="${t.done ? 'ok' : ''}">${t.done ? '已完成' : '未完成'}</em>
        </button>
        <button class="yt-score${typeof t.score === 'number' ? ' has' : ''}" data-action="score" data-id="${t.id}" data-year="${year}" data-kind="${kind || ''}">${typeof t.score === 'number' ? t.score : '分'}</button>
        <button class="yt-tick${t.done ? ' on' : ''}" data-action="toggle-year" data-id="${t.id}" data-year="${year}" data-kind="${kind || ''}" aria-label="切换完成">✓</button>
      </div>`).join('') : '<p class="note">这一年还没有安排</p>'}
    <button class="ghost wide" data-action="year-add" data-year="${year}" data-kind="${kind || ''}">添加${kind ? KIND_NAME[kind] : ''}任务</button>
  </div>`;
}

function textClass(t) {
  const rate = scoreRate(t);
  if (rate != null) return 'rec ' + rateClass(rate);
  return t.done ? 'ok' : 'plan';
}

function matrixCell(c, kind) {
  if (kind === '阅' && c.texts) {
    return `<span class="tx">${c.texts.map((t) => t ? `<i class="${textClass(t)}"></i>` : '<i class="empty"></i>').join('')}</span>`;
  }
  if (c.rec) {
    const rate = scoreRate(c.rec);
    return `<i class="rec ${rateClass(rate)}">${typeof c.rec.score === 'number' ? fmt1(c.rec.score) : '✓'}</i>`;
  }
  if (c.scores.length) {
    const rate = c.scores.reduce((a, b) => a + b, 0) / c.scores.length;
    return `<i class="rec ${rateClass(rate)}">${fmt1(rate * 10)}</i>`;
  }
  if (!c.plan) return '<i class="none">·</i>';
  if (c.done >= c.plan) return '<i class="ok">✓</i>';
  return '<i class="plan"></i>';
}

function englishStats() {
  const start = shift(today(), -6);
  const week = rangeStats(start, today());
  const rows = englishMatrix();
  const scored = englishPool().filter((t) => scoreRate(t) != null);
  const avgRate = scored.length ? scored.reduce((a, t) => a + scoreRate(t), 0) / scored.length : null;
  const types = englishTypes();
  const total = englishPool().filter((t) => kindOf(t)).length;
  return `<section class="stat-row">
      <div class="stat"><b>${week.done.length}<small>/${week.list.length}</small></b><span>近 7 天完成</span></div>
      <div class="stat"><b>${Math.round(week.actualMinutes / 7)}</b><span>日均分钟</span></div>
      <div class="stat"><b class="${rateClass(avgRate)}">${avgRate == null ? '—' : fmt1(avgRate * 100) + '<small>%</small>'}</b><span>得分率</span></div>
    </section>
    <details class="card details-card">
      <summary><span>历年真题</span><em>${rows.filter((r) => r.total).length} 年 · ${total} 项</em></summary>
      <div class="details-body">
        <p class="note">阅读按二刷、其他题型按一刷统计。</p>
        <div class="matrix">
          <div class="mhead"><span>年份</span>${EXAM_SHAPE.map(([k]) => `<i>${k}</i>`).join('')}</div>
          ${rows.map((r) => `<div class="mrow${r.total ? '' : ' off'}">
            <button class="myear" data-action="year" data-year="${r.y}">${r.y}</button>
            ${EXAM_SHAPE.map(([k]) => `<button class="mcell" data-action="year" data-year="${r.y}" data-kind="${k}" aria-label="${r.y} 年 ${KIND_NAME[k]}">${matrixCell(r.cells[k], k)}</button>`).join('')}
          </div>`).join('')}
        </div>
        <div class="row-btns">
          <button class="ghost" data-action="backfill">手动补录</button>
          <button class="ghost" data-action="import-records">粘贴记录</button>
        </div>
      </div>
    </details>
    <section class="card">
      <h2>题型进度</h2>
      ${types.map((t) => {
        const rates = t.scored.map((x) => x.rate);
        const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        const pct = Math.round((t.done / (t.plan || 1)) * 100);
        return `<div class="type-row">
          <span>${t.k}</span><b>${t.done}/${t.plan}</b>
          <i><u style="width:${pct}%"></u></i>
          <em class="${rateClass(avg)}">${avg == null ? pct + '%' : fmt1(avg * 100) + '%'}</em>
        </div>`;
      }).join('') || '<p class="note">暂无任务</p>'}
    </section>`;
}

function politicsStatsView() {
  const s = politicsStats();
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
    </section>`;
}

function statsFooter() {
  const s = rangeStats(shift(today(), -6), today());
  return `<section class="card">
      <h2>近 7 天</h2>
      <p class="week-summary"><b>${s.done.length}/${s.list.length}</b> 项完成 <span>·</span> 日均 ${Math.round(s.actualMinutes / 7)} 分钟</p>
      <button class="ghost wide" data-action="copy" data-scope="week">复制近 7 天记录</button>
    </section>`;
}

function statsView() {
  return (subject === 'english' ? englishStats() : politicsStatsView()) + statsFooter();
}

function meView() {
  const p = progress();
  const [englishCount, politicsCount] = countBySubject().split(' / ');
  const status = state.prefs.token
    ? (syncState === 'error' ? '同步失败，稍后重试' : syncState === 'syncing' ? '同步中…' : `已连接 · 版本 ${state.rev}`)
    : '未连接';
  const theme = state.prefs.theme || 'auto';
  return `<section class="card">
      <h2>学习概况</h2>
      <div class="profile-metrics">
        <div><b>${p.count}</b><span>待做任务</span></div>
        <div><b>${p.remain}</b><span>待做分钟</span></div>
        <div><b>${p.days}</b><span>距离初试 · 天</span></div>
      </div>
      <p class="note">英语二 ${englishCount} 项 · 政治 ${politicsCount} 项</p>
    </section>
    <section class="card">
      <h2>云同步</h2>
      <div class="row"><span>状态</span><em>${status}</em></div>
      ${state.prefs.token
        ? `<button class="ghost wide" data-action="sync-now">立即同步</button>
          <details class="subsettings">
            <summary>更换同步密码</summary>
            <div class="details-body">
              <label class="field"><span>新同步密码</span><input id="pref-token" type="password" value="" placeholder="留空则不修改"></label>
              <button class="ghost wide" data-action="save-prefs">保存同步设置</button>
            </div>
          </details>`
        : `<label class="field"><span>同步密码</span><input id="pref-token" type="password" value="" placeholder="部署时生成，只需填一次"></label>
          <button class="cta" data-action="save-prefs">连接并同步</button>`}
    </section>
    <section class="card">
      <h2>计划与记录</h2>
      <button class="cta" data-action="import">导入计划或记录</button>
      <button class="ghost wide" data-action="import-progress">同步最新完成记录</button>
      <button class="ghost wide" data-action="export">备份当前科目</button>
    </section>
    <details class="card details-card">
      <summary><span>学习与外观</span></summary>
      <div class="details-body">
        <label class="check-line"><input type="checkbox" id="pref-review"${state.prefs.autoReview ? ' checked' : ''}> 每天打开时自动整理逾期与超量任务</label>
        <button class="ghost wide" data-action="review-now">现在整理一次</button>
        <div class="setting-block">
          <span class="setting-label">外观</span>
          <div class="segmented wide-seg" role="tablist">
            <button data-theme-choice="auto" class="${theme === 'auto' ? 'on' : ''}">跟随系统</button>
            <button data-theme-choice="light" class="${theme === 'light' ? 'on' : ''}">白天</button>
            <button data-theme-choice="dark" class="${theme === 'dark' ? 'on' : ''}">夜间</button>
          </div>
        </div>
      </div>
    </details>
`;
}

/* ---------------- 编辑 ---------------- */
function openSheet(t) {
  const isNew = !t.id;
  // 新任务也要带上调用方给的年份/题型/日期，否则年份面板的「添加」会丢参数
  const draft = isNew ? { date: selected, title: '', type: '阅读', minutes: 30, note: '', ...t } : t;
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
    const list = Array.isArray(data) ? data : (data.tasks || data.plan || []);
    if (!Array.isArray(list)) throw new Error('任务列表格式错误');
    return list.filter((x) => x && typeof x === 'object' && String(x.title || '').trim()).map((x) => {
      const rawScore = x.score;
      const score = rawScore === '' || rawScore === null || rawScore === undefined ? null : Number(rawScore);
      const scoreMax = Number(x.scoreMax) > 0 ? Number(x.scoreMax) : 10;
      if (score !== null && (!Number.isFinite(score) || score < 0 || score > scoreMax)) throw new Error('得分超出范围');
      const done = !!x.done || score !== null;
      return {
        id: x.id || uid(), subject: ['english', 'politics'].includes(x.subject) ? x.subject : subject,
        date: x.date === '' ? '' : normalizeDate(x.date), title: String(x.title).trim(),
        type: TYPES.includes(x.type) ? x.type : '其他',
        minutes: Number(x.minutes) > 0 ? Number(x.minutes) : 30,
        done, notDone: !done && !!x.notDone, score, scoreMax,
        round: x.round === 1 || x.round === 2 ? x.round : undefined,
        note: String(x.note || ''), actualMinutes: x.actualMinutes === null || x.actualMinutes === undefined ? null : Number(x.actualMinutes),
        updatedAt: Date.now()
      };
    });
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

function progressKey(t) {
  const title = String(t.title || '');
  const year = (title.match(/\b20\d{2}\b/) || [])[0];
  if (!year || t.subject !== 'english') return '';
  const kind = kindOf(t);
  if (!kind) return '';
  const round = roundOf(t);
  if (kind === '阅') {
    const m = title.match(/\b(?:text|t)\s*([1-4])\b/i);
    if (!m) return '';
    return t.subject + '|' + year + '|' + kind + '|T' + m[1] + '|' + round;
  }
  return t.subject + '|' + year + '|' + kind + '|' + round;
}

function mergeProgress(records) {
  let added = 0, updated = 0, unchanged = 0;
  for (const rec of records) {
    if (!rec.done) continue;
    const key = progressKey(rec);
    const pool = live().filter((t) => t.subject === rec.subject);
    const exact = pool.filter((t) => t.date === rec.date && t.title === rec.title);
    const similar = key ? pool.filter((t) => progressKey(t) === key) : [];
    const candidates = exact.length ? exact : similar;
    // 不覆盖已经由用户打卡的日期，优先合并未完成的原计划。
    const same = candidates.find((t) => !t.done && !t.notDone) || candidates.find((t) => t.done) || candidates[0];
    if (!same) {
      state.tasks.push(rec);
      added++;
      continue;
    }
    const patch = { done: true, notDone: false };
    if (!same.done && rec.date) patch.date = rec.date;
    if (typeof rec.score === 'number' && (typeof same.score !== 'number' || same.score !== rec.score)) {
      patch.score = rec.score;
      patch.scoreMax = rec.scoreMax || 10;
    }
    if (rec.actualMinutes !== null && Number.isFinite(rec.actualMinutes) && same.actualMinutes == null) {
      patch.actualMinutes = rec.actualMinutes;
    }
    if (rec.note && !same.note) patch.note = rec.note;
    const changed = Object.entries(patch).some(([k, v]) => same[k] !== v);
    if (changed) {
      Object.assign(same, patch);
      touch(same);
      updated++;
    } else unchanged++;
  }
  return { added, updated, unchanged };
}

function openImport(preset) {
  $('#modal').hidden = false;
  $('#modal').innerHTML = `<div class="sheet">
    <header><h2>导入计划</h2><button data-action="close">×</button></header>
    <p class="note">支持粘贴或选择本机文件。已完成记录请选「同步进度」。</p>
    <label class="field"><span>从手机选择 JSON / TXT</span><input id="import-file" type="file" accept=".json,.txt,text/plain,application/json"></label>
    <textarea id="import-text" rows="8" placeholder="| 2026-10-21 | 阅读真题 2021 T1 | 阅读 | 40 |&#10;2026-10-22 翻译 长难句 30分钟"></textarea>
    <div class="modes">
      <label><input type="radio" name="import-mode" value="range"${preset === 'range' ? ' checked' : ''}><span><b>按日期覆盖</b><em>替换导入日期内的待做安排</em></span></label>
      <label><input type="radio" name="import-mode" value="merge"${preset === 'merge' || !preset ? ' checked' : ''}><span><b>只添加</b><em>重复记录自动跳过</em></span></label>
      <label><input type="radio" name="import-mode" value="progress"${preset === 'progress' ? ' checked' : ''}><span><b>同步学习进度</b><em>匹配原任务，更新完成状态和得分，不删除计划</em></span></label>
      <label><input type="radio" name="import-mode" value="records"${preset === 'records' ? ' checked' : ''}><span><b>补录旧题</b><em>没有日期的真题历史记录</em></span></label>
    </div>
    <details class="subsettings">
      <summary>补录轮次设置</summary>
      <div class="details-body"><label class="field"><span>默认轮次</span><select id="record-round">
        <option value="1">一刷</option><option value="2" selected>二刷</option>
      </select></label></div>
    </details>
    <button class="cta wide" data-action="import-run">导入</button>
  </div>`;
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
  const list = live().filter((t) => {
    if (!mine(t)) return false;
    // 「全部」要包含无日期的补录记录：空字符串比任何日期都小，不能用日期下界过滤
    if (scope === 'all') return true;
    return t.date >= from && t.date <= to;
  }).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
  const lines = [`【${name}】${from ? from + ' ~ ' + to : '全部'}`];
  // null 而不是 ''：补录记录的日期也是空字符串，否则第一组「历史记录」不会打标题
  let last = null;
  for (const t of list) {
    const mark = t.done ? '✅' : t.notDone ? '❌' : '⭕';
    const actual = t.actualMinutes ? `（实际 ${t.actualMinutes} 分钟）` : '';
    if (t.date !== last) { lines.push(t.date ? `${t.date} ${weekday(t.date)}` : '历史记录（无日期）'); last = t.date; }
    const mins = t.minutes ? ` ${t.minutes} 分钟` : '';
    const score = typeof t.score === 'number' ? ` · 得分 ${t.score}/${t.scoreMax || 10}` : '';
    lines.push(`${mark} ${t.title} · ${t.type}${mins}${score}${actual}${t.note ? ' · 备注：' + t.note : ''}`);
  }
  const s = scope === 'all'
    ? { list, done: list.filter((t) => t.done) }
    : rangeStats(from, to);
  const p = progress();
  lines.push(`— 合计：完成 ${s.done.length}/${s.list.length} 项`);
  lines.push(`— 进度：还剩 ${p.count} 项，到考试 ${p.days} 天${p.behind ? '（落后）' : ''}`);
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
  const el = e.target.closest('[data-action],[data-view],[data-subject],[data-theme-choice],[data-round]');
  if (!el) { if (e.target.id === 'modal') closeSheet(); return; }
  if (el.dataset.view) { view = el.dataset.view; if (view === 'calendar') calMonth = selected.slice(0, 7); render(); return; }
  if (el.dataset.subject) { subject = el.dataset.subject; state.prefs.subject = subject; save(); render(); return; }
  if (el.dataset.round) { state.prefs.round = Number(el.dataset.round); save(); render(); return; }
  if (el.dataset.themeChoice) { state.prefs.theme = el.dataset.themeChoice; save(); applyTheme(); render(); return; }
  const a = el.dataset.action;
  if (a === 'day') { selected = shift(selected, Number(el.dataset.n)); render(); return; }
  if (a === 'month') {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.n), 1, 12);
    calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; render(); return;
  }
  if (a === 'pick') { selected = el.dataset.date; calMonth = selected.slice(0, 7); render(); return; }
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
  if (a === 'import-records') { openImport('records'); return; }
  if (a === 'import-progress') { openImport('progress'); return; }
  if (a === 'clear-records') {
    const hit = state.tasks.filter((t) => !t.deleted && !t.date);
    if (!hit.length) return toast('没有补录记录');
    if (!confirm('删除全部 ' + hit.length + ' 条补录记录？')) return;
    pushUndo();
    for (const t of hit) { t.deleted = true; touch(t); }
    state.dirty = true; save(); render(); schedulePush();
    toast('已清空 ' + hit.length + ' 条');
    return;
  }
  if (a === 'score') {
    const t = findTask(el.dataset.id);
    if (!t) return;
    const input = prompt('得分（满分 ' + (t.scoreMax || 10) + '）', typeof t.score === 'number' ? t.score : '');
    if (input === null) return;
    const n = Number(input);
    if (!Number.isFinite(n)) return toast('请输入数字');
    t.score = Math.max(0, Math.min(100, n));
    t.scoreMax = t.scoreMax || 10;
    t.done = true; t.notDone = false;
    touch(t); save(); render(); push().catch(() => {});
    openYear(Number(el.dataset.year), el.dataset.kind || '');
    return;
  }
  if (a === 'toggle-year') {
    const t = findTask(el.dataset.id);
    if (t) {
      t.done = !t.done;
      if (t.done) t.notDone = false;
      touch(t); save(); render(); push().catch(() => {});
      openYear(Number(el.dataset.year), el.dataset.kind || '');
    }
    return;
  }
  if (a === 'year') { openYear(Number(el.dataset.year), el.dataset.kind || ''); return; }
  if (a === 'year-add') {
    const year = el.dataset.year, kind = el.dataset.kind;
    // 年份面板加的是「现在要做的这一年真题」，不能落在那一年的 12 月，否则会被每日整理当成逾期搬走
    openSheet({ date: today(), title: year + ' ', type: KIND_TYPE[kind] || '阅读', minutes: 30 });
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
    if (typeof patch.score === 'number') { patch.done = true; patch.notDone = false; }
    const t = id ? findTask(id) : addTask(patch);
    if (id && t) { Object.assign(t, patch); touch(t); }
    save(); closeSheet(); render(); push().catch(() => {}); return;
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
    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
    let parsed = [];
    try { parsed = mode === 'records' ? parseRecords(text, Number(($('#record-round') || {}).value) || 2) : parsePlan(text); } catch { return toast('格式无法识别'); }
    if (!parsed.length) return toast('没有识别到内容');
    pushUndo();
    let removed = 0, kept = 0, added = 0;
    if (mode === 'records') {
      let updated = 0;
      for (const rec of parsed) {
        const same = state.tasks.find((t) => !t.deleted && !t.date && t.title === rec.title);
        if (same) {
          same.score = rec.score;
          same.scoreMax = rec.scoreMax;
          same.done = true;
          touch(same);
          updated++;
        } else {
          state.tasks.push(rec);
          added++;
        }
      }
      state.dirty = true;
      save(); closeSheet(); render(); schedulePush();
      toast('新增 ' + added + (updated ? ' · 更新 ' + updated : ''));
      return;
    }
    if (mode === 'progress') {
      if (!parsed.every((t) => t.done)) return toast('同步进度只能导入已完成记录');
      const result = mergeProgress(parsed);
      if (result.added || result.updated) { state.dirty = true; save(); schedulePush(); }
      closeSheet(); render();
      toast('进度已合并 · 新增 ' + result.added + ' · 更新 ' + result.updated + ' · 已存在 ' + result.unchanged);
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
      const keyOf = (t) => `${t.subject}|${t.date}|${t.title}`;
      const seen = new Set(live().map(keyOf));
      const fresh = parsed.filter((t) => {
        const key = keyOf(t);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      state.tasks = state.tasks.concat(fresh); added = fresh.length;
    }
    state.dirty = true; save(); closeSheet(); render(); schedulePush();
    toast('新增 ' + added + (removed ? ' · 删除 ' + removed : '') + (kept ? ' · 保留已完成 ' + kept : ''));
    return;
  }
  if (a === 'export') { exportAll(); return; }
  if (a === 'copy') { copyText(gptText(el.dataset.scope), '学习情况'); return; }
  if (a === 'clear') {
    if (!confirm('清空「' + (subject === 'english' ? '英语二' : '政治') + '」的全部任务？云端也会同步删除。')) return;
    pushUndo();
    for (const t of state.tasks) if (t.subject === subject && !t.deleted) { t.deleted = true; touch(t); }
    state.dirty = true; save(); render(); schedulePush(); toast('已清空，可撤销');
    return;
  }
  if (a === 'sync-now') {
    if (!state.prefs.token) { syncState = 'idle'; render(); return toast('未连接云端'); }
    await pull();
    toast(syncState === 'error' ? '同步失败，稍后重试' : '已同步');
    return;
  }
  if (a === 'save-prefs') {
    const token = $('#pref-token')?.value.trim();
    if (token) state.prefs.token = token;
    if ($('#pref-review')) state.prefs.autoReview = $('#pref-review').checked;
    save();
    if (!state.prefs.token) { syncState = 'idle'; render(); toast('未连接云端'); return; }
    // pull() 内部会吞掉网络错误，只能看 syncState 判断这次是否真的连上
    try { await pull(); } catch {}
    toast(syncState === 'error' ? '连接失败，检查口令' : '已连接云端');
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

document.addEventListener('change', async (e) => {
  if (e.target.id === 'import-file') {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) return toast('文件超过 1 MB，请拆分导入');
    try { $('#import-text').value = await file.text(); } catch { toast('文件读取失败'); }
    return;
  }
  if (e.target.id === 'pref-review') {
    state.prefs.autoReview = e.target.checked;
    save();
    toast(e.target.checked ? '已开启每日整理' : '已关闭每日整理');
  }
});

function toast(message, action) {
  const el = $('#toast'); el.hidden = false; el.textContent = message;
  el.onclick = action ? () => { action(); el.hidden = true; } : null;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2800);
}

applyTheme();
const linked = takeTokenFromLink();
render();
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
  checkUpdate();
  const action = params.get('action');
  if (action === 'import') openImport(params.get('mode') || '');
  if (action === 'year') openYear(Number(params.get('year') || 2015), params.get('kind') || '');
});
let lastCheck = Date.now();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  pull().catch(() => {});
  if (Date.now() - lastCheck > 300000) { lastCheck = Date.now(); checkUpdate(); }
});
window.addEventListener('online', () => { if (state.dirty) push().catch(() => {}); });
})();
