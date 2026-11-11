/* 내 건강 기록 — 모든 기록은 이 기기의 브라우저 저장공간(localStorage)에만 저장됩니다. */
'use strict';

const KEY = 'hc-data-v1';
const APP_VERSION = '1.0.0';
const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const BP_TAGS = ['기상 후', '복용 전', '운동 후', '자기 전', '기타'];
const SKIP_REASONS = ['비·날씨', '피곤함', '일정', '몸 상태', '기타'];

const THEMES = [
  { id: 'A', name: 'A 세이지 그린', c: ['#F6F4EE', '#4F7360', '#C9A66B'] },
  { id: 'B', name: 'B 네이비', c: ['#F4F5F7', '#2F4A6D', '#E08A5B'] },
  { id: 'C', name: 'C 라벤더 그레이', c: ['#F7F6FA', '#5E5D8F', '#8FB8A8'] },
  { id: 'D', name: 'D 다크 차콜', c: ['#1E2226', '#7FC8B5', '#F2C46D'] }
];

const FEATURE_DEFS = [
  { group: '혈압약', items: [
    ['medCheck', '원탭 복용 체크', '끄면 오늘 화면에서 복용 카드가 사라져요'],
    ['medRemind', '복용 재알림', '정한 시각에 한 번 더 알림'],
    ['medStock', '남은 약 · 처방 갱신 알림', '남은 날짜가 적으면 알려 줘요'],
    ['medHistory', '약 변경 이력', '변경일을 혈압 그래프에 표시']
  ] },
  { group: '혈압', items: [
    ['bpTag', '측정 상황 태그', '기상 후 · 복용 전 · 운동 후 · 자기 전'],
    ['bpAvg', '연속 측정 평균', '2회 측정하면 평균 자동 계산'],
    ['bpGoal', '목표 범위선', '의사와 정한 목표를 그래프에 표시'],
    ['bpReport', '진료용 요약', '최근 4주 요약 · PDF 저장']
  ] },
  { group: '운동', items: [
    ['exDetail', '항목별 상세 기록', '시간 · 거리 · 초 · 횟수'],
    ['exPartial', '부분 완료 · 건너뜀 사유', '“러닝만 함”, “비 와서 쉼”'],
    ['exRate', '계획 대비 달성률', '이번 주 계획 중 몇 회'],
    ['exVersion', '프로그램 버전 관리', '바꿔도 예전 기록 유지']
  ] },
  { group: '통합', items: [
    ['mixCompare', '운동한 날 vs 쉰 날 혈압', '운동 효과를 숫자로'],
    ['mixStreak', '연속 기록 표시', '복용 연속 일수 · 운동 연속 주'],
    ['mixExport', '데이터 내보내기', '엑셀(CSV)로 저장']
  ] },
  { group: '추가 기능', items: [
    ['weight', '체중 기록', '켜면 오늘 · 통계 화면에 추가돼요']
  ] }
];

const ALARM_DEFS = [
  ['med', '혈압약 복용', '매일', null],
  ['medAgain', '복용 재알림', '매일 · 안 드셨으면', 'medRemind'],
  ['bpAm', '아침 혈압 측정', '매일', null],
  ['bpPm', '자기 전 혈압 측정', '매일', null],
  ['exEve', '운동 전날 미리 알림', '다음 날 운동 있을 때', null],
  ['exDay', '운동 당일 알림', '운동 있는 날', null]
];

/* ---------- 날짜 도우미 ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseYmd = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const todayStr = () => ymd(new Date());
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const nowLocalDT = () => todayStr() + 'T' + nowHM();
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
const fmtKDate = d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + DOW[d.getDay()] + '요일';
const fmtMD = d => (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const num = v => { if (v === '' || v == null) return null; const n = Number(v); return isFinite(n) ? n : null; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r0 = n => n == null ? '–' : String(Math.round(n));

/* ---------- 데이터 ---------- */
function defaultData() {
  const t = todayStr();
  return {
    v: 1,
    created: t,
    settings: {
      theme: 'A', autoNight: false, nightStart: '19:00', nightEnd: '07:00', font: 'large',
      features: { medCheck: true, medRemind: true, medStock: true, medHistory: true, bpTag: true, bpAvg: true, bpGoal: true, bpReport: true, exDetail: true, exPartial: true, exRate: true, exVersion: true, mixCompare: true, mixStreak: true, mixExport: true, weight: false },
      alarms: { med: { on: true, time: '08:00' }, medAgain: { on: true, time: '09:30' }, bpAm: { on: true, time: '07:00' }, bpPm: { on: true, time: '22:30' }, exEve: { on: true, time: '21:00' }, exDay: { on: true, time: '07:30' } },
      med: { name: '혈압약', dose: '', start: '08:00', end: '09:00', stock: null, stockDate: null, warnDays: 7 },
      bpGoal: { s: null, d: null },
      backupDays: 30, lastBackup: null
    },
    medLog: {},
    medChanges: [],
    bp: [],
    programs: [{ id: uid(), start: t, days: {
      1: [{ name: '러닝', metric: 'min', goal: 30, dist: true }, { name: '벽스쿼트', metric: 'sec', goal: null }],
      3: [{ name: '러닝', metric: 'min', goal: 30, dist: true }, { name: '매달리기', metric: 'sec', goal: null }],
      5: [{ name: '러닝', metric: 'min', goal: 30, dist: true }, { name: '벽스쿼트', metric: 'sec', goal: null }, { name: '런지', metric: 'reps', goal: null, sets: null }],
      6: [{ name: '러닝', metric: 'min', goal: null, dist: true }]
    } }],
    exLog: {},
    weight: []
  };
}

function migrate(d) {
  const def = defaultData();
  if (!d || typeof d !== 'object') return def;
  d.v = 1;
  d.created = d.created || def.created;
  const s = d.settings = Object.assign({}, def.settings, d.settings || {});
  s.features = Object.assign({}, def.settings.features, s.features || {});
  s.alarms = Object.assign({}, def.settings.alarms, s.alarms || {});
  s.med = Object.assign({}, def.settings.med, s.med || {});
  s.bpGoal = Object.assign({}, def.settings.bpGoal, s.bpGoal || {});
  ['medLog', 'exLog'].forEach(k => { if (!d[k] || typeof d[k] !== 'object' || Array.isArray(d[k])) d[k] = {}; });
  ['bp', 'medChanges', 'weight', 'programs'].forEach(k => { if (!Array.isArray(d[k])) d[k] = []; });
  if (!d.programs.length) d.programs = def.programs;
  d.programs.sort((a, b) => a.start < b.start ? -1 : 1);
  return d;
}

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) return migrate(JSON.parse(raw)); } catch (e) { console.warn(e); }
  return defaultData();
}

let D = load();
let persistAsked = false;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(D)); }
  catch (e) { toast('저장공간이 부족해서 저장하지 못했어요. 백업 후 오래된 기록을 정리해 주세요.'); }
  if (!persistAsked && navigator.storage && navigator.storage.persist) {
    persistAsked = true;
    navigator.storage.persist().then(ok => { UI.persisted = ok; }).catch(() => {});
  }
}

const F = k => !!D.settings.features[k];

/* ---------- 화면 상태 ---------- */
const UI = {
  statsView: 'week', weekOff: 0, monthOff: 0,
  bp: null, progEdit: null, showVersions: false,
  modal: null, form: {}, toast: null, persisted: null,
  backupCycleDraft: null, restoreData: null
};
function newBpDraft() {
  const h = new Date().getHours();
  return { ts: nowLocalDT(), tag: h < 11 ? '기상 후' : (h >= 20 ? '자기 전' : ''), r: [{ s: '', d: '', p: '' }, { s: '', d: '', p: '' }], two: false, memo: '' };
}
UI.bp = newBpDraft();

/* ---------- 아이콘 ---------- */
const sv = (p, w) => '<svg width="' + (w || 24) + '" height="' + (w || 24) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
const IC = {
  check: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
  plus: sv('<path d="M12 5v14M5 12h14"/>', 22),
  back: sv('<path d="M15 5l-7 7 7 7"/>', 26),
  home: sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>', 26),
  rec: sv('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>', 26),
  run: sv('<path d="M3 12h4l3-8 4 16 3-8h4"/>', 26),
  stats: sv('<path d="M5 20V10M12 20V4M19 20v-7"/>', 26),
  set: sv('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>', 26),
  phone: sv('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  trash: sv('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 22),
  chevL: sv('<path d="M15 5l-7 7 7 7"/>', 24),
  chevR: sv('<path d="M9 5l7 7-7 7"/>', 24)
};

/* ---------- 계산 ---------- */
function programFor(ds) {
  let p = D.programs[0];
  for (const x of D.programs) if (x.start <= ds) p = x;
  return p;
}
function currentProgram() { return programFor(todayStr()); }
function planFor(ds) {
  const p = programFor(ds);
  if (!p || ds < D.programs[0].start) return [];
  return (p.days[parseYmd(ds).getDay()] || []).filter(it => it.name);
}
function exLogFor(ds) { return D.exLog[ds] || { items: {}, skip: '' }; }
function dayExStatus(ds) {
  const items = planFor(ds), log = D.exLog[ds], t = todayStr();
  const done = items.filter(it => log && log.items && log.items[it.name] && log.items[it.name].done).length;
  if (!items.length) return 'rest';
  if (done === items.length) return 'full';
  if (done > 0) return 'part';
  if (log && log.skip) return 'skip';
  if (ds < t) return 'miss';
  return 'plan';
}
function anyExDone(ds) {
  const log = D.exLog[ds];
  return !!(log && log.items && Object.values(log.items).some(x => x && x.done));
}
function medStatus(ds) {
  if (D.medLog[ds]) return 'full';
  if (ds < todayStr() && ds >= D.created) return 'miss';
  return 'empty';
}
function medRemaining() {
  const m = D.settings.med;
  if (m.stock == null || !m.stockDate) return null;
  const used = Object.keys(D.medLog).filter(k => k >= m.stockDate).length;
  return Math.max(0, m.stock - used);
}
function readingAvg(rd) {
  const rs = rd.r.filter(x => x.s != null && x.d != null);
  const ps = rd.r.map(x => x.p).filter(x => x != null);
  return { s: mean(rs.map(x => x.s)), d: mean(rs.map(x => x.d)), p: ps.length ? mean(ps) : null };
}
function slotOf(rd) {
  if (rd.tag === '기상 후' || rd.tag === '복용 전') return 'am';
  if (rd.tag === '자기 전') return 'pm';
  const h = Number(rd.ts.slice(11, 13));
  return h < 12 ? 'am' : (h >= 18 ? 'pm' : 'mid');
}
function avgOf(list) {
  if (!list.length) return null;
  const a = list.map(readingAvg);
  const ps = a.map(x => x.p).filter(x => x != null);
  return { s: mean(a.map(x => x.s)), d: mean(a.map(x => x.d)), p: ps.length ? mean(ps) : null, n: list.length };
}
function bpInRange(from, to) { return D.bp.filter(r => { const d = r.ts.slice(0, 10); return d >= from && d <= to; }); }
function sortedBp() { return D.bp.slice().sort((a, b) => a.ts < b.ts ? 1 : -1); }
function medStreak() {
  let d = new Date(); if (!D.medLog[ymd(d)]) d = addDays(d, -1);
  let n = 0; while (D.medLog[ymd(d)]) { n++; d = addDays(d, -1); }
  return n;
}
function weekExCounts(mon) {
  let planned = 0, full = 0, part = 0;
  for (let i = 0; i < 7; i++) {
    const ds = ymd(addDays(mon, i)); const st = dayExStatus(ds);
    if (st !== 'rest') planned++;
    if (st === 'full') full++; if (st === 'part') part++;
  }
  return { planned, full, part };
}
function exWeekStreak() {
  let mon = mondayOf(new Date()); let n = 0;
  const c0 = weekExCounts(mon);
  if (c0.planned && c0.full >= c0.planned) n++;
  mon = addDays(mon, -7);
  while (ymd(addDays(mon, 6)) >= D.created) {
    const c = weekExCounts(mon);
    if (!c.planned || c.full < c.planned) break;
    n++; mon = addDays(mon, -7);
  }
  return n;
}
function backupDue() {
  const s = D.settings; if (!s.backupDays) return null;
  const hasData = D.bp.length || Object.keys(D.medLog).length || Object.keys(D.exLog).length;
  if (!hasData) return null;
  const since = daysBetween(s.lastBackup || D.created, todayStr());
  return since >= s.backupDays ? since : null;
}
function itemLabel(it) { return it.name + (it.metric === 'min' && it.goal ? ' ' + it.goal + '분' : ''); }
function goalText(it) {
  if (it.metric === 'min') return it.goal ? '목표 ' + it.goal + '분' : '시간 자유';
  if (it.metric === 'sec') return it.goal ? '목표 ' + it.goal + '초' : '목표 미정';
  return it.goal ? '목표 ' + it.goal + '회' + (it.sets ? ' × ' + it.sets + '세트' : '') : '목표 미정';
}
function resultText(it, r) {
  if (!r) return '';
  if (it.metric === 'min') { const a = []; if (r.v != null) a.push(r.v + '분'); if (r.km != null) a.push(r.km + 'km'); return a.join(' · ') || '완료'; }
  if (it.metric === 'sec') return r.v != null ? r.v + '초' : '완료';
  return r.v != null ? r.v + '회' + (r.sets ? ' × ' + r.sets + '세트' : '') : '완료';
}

/* ---------- 차트 ---------- */
function lineChart(o) {
  const w = 320, h = o.h || 170, pl = 34, pr = 10, pt = 16, pb = 26, iw = w - pl - pr, ih = h - pt - pb;
  const n = o.labels.length;
  const vals = [];
  o.series.forEach(s => s.data.forEach(v => { if (v != null) vals.push(v); }));
  if (o.goal != null) vals.push(o.goal);
  if (!vals.length) return '<div class="empty">아직 표시할 기록이 없어요.</div>';
  let lo = Math.floor((Math.min.apply(null, vals) - 4) / 5) * 5, hi = Math.ceil((Math.max.apply(null, vals) + 4) / 5) * 5;
  if (hi - lo < 10) hi = lo + 10;
  if ((hi - lo) % 10) hi += 5;
  const x = i => pl + (n <= 1 ? iw / 2 : i * iw / (n - 1));
  const y = v => pt + (hi - v) / (hi - lo) * ih;
  let g = '';
  const step = (hi - lo) / 2;
  for (let k = 0; k <= 2; k++) { const v = lo + step * k; g += '<line class="grid" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text class="axis" x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + Math.round(v) + '</text>'; }
  if (o.goal != null) g += '<line class="goal" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + y(o.goal) + '" y2="' + y(o.goal) + '"/><text class="axis" x="' + (w - pr) + '" y="' + (y(o.goal) - 5) + '" text-anchor="end">목표 ' + o.goal + '</text>';
  (o.markers || []).forEach(m => { const xx = x(m.i); g += '<line class="mark" x1="' + xx + '" x2="' + xx + '" y1="' + pt + '" y2="' + (pt + ih) + '"/><text class="axis" x="' + (xx + 4) + '" y="' + (pt + 8) + '">' + esc(m.label) + '</text>'; });
  o.series.forEach((s, si) => {
    let seg = [];
    const flush = () => { if (seg.length > 1) g += '<polyline class="s' + (si + 1) + '" points="' + seg.join(' ') + '"/>'; seg = []; };
    s.data.forEach((v, i) => { if (v == null) flush(); else { seg.push(x(i).toFixed(1) + ',' + y(v).toFixed(1)); g += '<circle class="p' + (si + 1) + '" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="3.5"/>'; } });
    flush();
  });
  const every = n > 8 ? Math.ceil(n / 6) : 1;
  o.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) g += '<text class="axis" x="' + x(i) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(l) + '</text>'; });
  return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || '추이 그래프') + '">' + g + '</svg>';
}
const legend2 = (a, b) => '<div class="legend"><span><i class="lg-line"></i>' + a + '</span><span><i class="lg-dash"></i>' + b + '</span></div>';

/* ---------- 공통 조각 ---------- */
const card = (inner, cls) => '<section class="card ' + (cls || '') + '">' + inner + '</section>';
const toggleBtn = (on, act, arg, label) => '<button type="button" class="toggle" data-act="' + act + '" data-arg="' + esc(arg) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '"><span></span></button>';
const backHead = (href, title) => '<div class="top-back"><a class="back-btn" href="' + href + '" aria-label="뒤로">' + IC.back + '</a><h1>' + title + '</h1></div>';

function nav(route) {
  const tabFor = { today: 'today', record: 'record', program: 'program', stats: 'stats', features: 'features', settings: 'features', data: 'features', med: 'features', report: 'stats' };
  const cur = tabFor[route] || 'today';
  const tabs = [['today', '오늘', IC.home], ['record', '기록', IC.rec], ['program', '운동', IC.run], ['stats', '통계', IC.stats], ['features', '설정', IC.set]];
  return '<nav class="tabs" aria-label="메뉴">' + tabs.map(t => '<a href="#' + t[0] + '" class="' + (cur === t[0] ? 'on' : '') + '"' + (cur === t[0] ? ' aria-current="page"' : '') + '>' + t[2] + t[1] + '</a>').join('') + '</nav>';
}

/* ---------- 오늘 ---------- */
function viewToday() {
  const now = new Date();
  let h = '<header class="top"><div><div class="sub">' + fmtKDate(now) + '</div><h1>오늘</h1></div><a class="icon-btn" href="#features" aria-label="설정">' + IC.set + '</a></header>';
  const due = backupDue();
  if (due != null) h += '<div class="banner"><span class="t"><b>백업한 지 ' + due + '일 지났어요</b><span class="sub">기록을 파일로 저장해 두세요</span></span><button class="ghost-btn" data-act="backup">백업</button></div>';
  if (F('medStock')) { const r = medRemaining(); if (r != null && r <= D.settings.med.warnDays) h += '<div class="banner"><span class="t"><b>남은 약 ' + r + '일분</b><span class="sub">처방 갱신을 준비하세요</span></span><a class="ghost-btn" href="#med">수정</a></div>'; }
  if (F('mixStreak')) {
    const ms = medStreak(), mon = mondayOf(now), c = weekExCounts(mon);
    h += '<div class="row wrap">' + (ms ? '<span class="chip">복용 ' + ms + '일 연속</span>' : '') + (c.planned ? '<span class="chip accent">이번 주 운동 ' + c.full + ' / ' + c.planned + '</span>' : '') + '</div>';
  }
  if (F('medCheck')) h += medCard();
  h += bpCard();
  h += exCard(todayStr());
  if (F('weight')) h += weightCard();
  h += weekCard();
  return '<main class="page">' + h + '</main>';
}
function medCard() {
  const m = D.settings.med, log = D.medLog[todayStr()];
  let body;
  if (log) {
    const late = log.time > m.end;
    body = '<div class="done-box"><span class="check-circle">' + IC.check + '</span><div style="flex:1"><div class="done-title">' + (late ? '복용 완료 (늦게)' : '복용 완료') + '</div><div class="sub">오늘 ' + log.time + '</div></div><button class="link-btn" data-act="medUndo">취소</button></div>';
  } else {
    body = '<button class="big-btn" data-act="medTake">' + IC.check + ' 지금 복용 완료</button>';
  }
  let foot = '';
  if (F('medStock')) { const r = medRemaining(); foot = r == null ? '<a class="sub" href="#med">남은 약 수 입력하기</a>' : '<div class="sub">남은 약 ' + r + '일분</div>'; }
  return card('<div class="row-between"><span class="card-title">' + esc(m.name || '혈압약') + '</span><span class="sub">' + m.start + ' – ' + m.end + '</span></div>' + body + foot);
}
function whenLabel(ts) {
  const d = ts.slice(0, 10), t = todayStr();
  const pre = d === t ? '오늘' : (d === ymd(addDays(new Date(), -1)) ? '어제' : fmtMD(parseYmd(d)));
  return pre + ' ' + ts.slice(11, 16);
}
function bpCard() {
  const last = sortedBp()[0];
  let mid = '<div class="empty">아직 기록이 없어요.</div>';
  if (last) {
    const a = readingAvg(last);
    mid = '<div class="row" style="align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big-num">' + r0(a.s) + ' / ' + r0(a.d) + '</span><span class="sub">mmHg</span>' + (a.p != null ? '<span class="sub" style="margin-left:auto">맥박 ' + r0(a.p) + '</span>' : '') + '</div>';
  }
  const meta = last ? whenLabel(last.ts) + (last.tag && F('bpTag') ? ' · ' + esc(last.tag) : '') : '';
  return card('<div class="row-between"><span class="card-title">혈압</span><span class="sub">' + meta + '</span></div>' + mid + '<a class="big-btn" href="#record">' + IC.plus + ' 혈압 기록하기</a>');
}
function exCard(ds) {
  const items = planFor(ds), log = exLogFor(ds);
  if (!items.length) {
    return card('<div class="row-between"><span class="card-title">오늘 운동</span><a class="sub" href="#program">프로그램</a></div><div class="empty" style="font-size:1.05rem">오늘은 쉬는 날이에요.</div>');
  }
  const done = items.filter(it => log.items[it.name] && log.items[it.name].done).length;
  let rows = items.map((it, i) => {
    const r = log.items[it.name], isDone = r && r.done;
    const sub = isDone ? resultText(it, r) : goalText(it) + (F('exDetail') ? ' · 눌러서 기록' : ' · 눌러서 완료');
    return '<button type="button" class="ex-row" data-act="exOpen" data-arg="' + ds + '|' + i + '"><span class="' + (isDone ? 'check-circle sm' : 'ring') + '">' + (isDone ? IC.check : '') + '</span><span class="ex-text"><span class="ex-name">' + esc(itemLabel(it)) + '</span><span class="sub">' + esc(sub) + '</span></span></button>';
  }).join('');
  let foot = '';
  if (log.skip) foot += '<div class="warn-box"><b>건너뜀 · ' + esc(log.skip) + '</b>' + (log.note ? '<span class="sub">' + esc(log.note) + '</span>' : '') + '</div>';
  if (F('exPartial') && done < items.length) foot += '<button class="ghost-btn" data-act="exSkip" data-arg="' + ds + '">' + (log.skip ? '사유 수정' : '오늘 건너뛰기 · 메모') + '</button>';
  return card('<div class="row-between"><span class="card-title">오늘 운동</span><span class="sub">' + done + ' / ' + items.length + ' 완료</span></div>' + rows + foot);
}
function weightCard() {
  const w = D.weight.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
  return card('<div class="row-between"><span class="card-title">체중</span><span class="sub">' + (w ? (w.date === todayStr() ? '오늘' : fmtMD(parseYmd(w.date))) : '') + '</span></div><div class="row-center"><span class="big-num">' + (w ? w.kg : '–') + '<span class="sub" style="font-size:1rem"> kg</span></span><button class="ghost-btn" data-act="weightOpen">기록</button></div>');
}
function weekCard() {
  const mon = mondayOf(new Date()), t = todayStr();
  let head = '<span></span>', med = '<span class="lbl">약</span>', ex = '<span class="lbl">운동</span>';
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), ds = ymd(d);
    head += '<span class="d' + (ds === t ? ' today' : '') + '">' + DOW[d.getDay()] + '</span>';
    med += '<span class="dot ' + medStatus(ds) + '"></span>';
    ex += '<span class="sq ' + dayExStatus(ds) + '"></span>';
  }
  return card('<div class="row-between"><span class="card-title">이번 주</span><a class="sub" href="#stats">통계 보기</a></div><div class="week-grid">' + head + (F('medCheck') ? med : '') + ex + '</div>');
}

/* ---------- 혈압 기록 ---------- */
function viewRecord() {
  const b = UI.bp;
  let h = '<h1>혈압 기록</h1>';
  h += '<label class="field">측정 시각<input type="datetime-local" data-bind="bp.ts" value="' + esc(b.ts) + '"></label>';
  if (F('bpTag')) h += '<div class="field">언제 쟀나요?<div class="tags">' + BP_TAGS.map(t => '<button type="button" class="tag' + (b.tag === t ? ' on' : '') + '" aria-pressed="' + (b.tag === t) + '" data-act="bpTag" data-arg="' + t + '">' + t + '</button>').join('') + '</div></div>';
  const inputs = i => '<div class="grid2"><label class="field">수축기 (위)<input class="num-input" type="number" inputmode="numeric" data-bind="bp.r' + i + 's" value="' + esc(b.r[i].s) + '" placeholder="–"></label><label class="field">이완기 (아래)<input class="num-input" type="number" inputmode="numeric" data-bind="bp.r' + i + 'd" value="' + esc(b.r[i].d) + '" placeholder="–"></label></div><label class="field" style="flex-direction:row;align-items:center;justify-content:space-between">맥박 (선택)<input class="inp num-mid" style="width:9rem" type="number" inputmode="numeric" data-bind="bp.r' + i + 'p" value="' + esc(b.r[i].p) + '" placeholder="–"></label>';
  h += card('<span class="card-title">' + (F('bpAvg') ? '1회차' : '측정값') + '</span>' + inputs(0));
  if (F('bpAvg')) {
    if (!b.two) h += '<button class="out-btn" data-act="bpTwo">+ 2회차 측정 추가 (1~2분 뒤)</button>';
    else h += card('<div class="row-between"><span class="card-title">2회차</span><button class="link-btn" data-act="bpOne">빼기</button></div>' + inputs(1) + '<div class="avg-box" id="bp-avg">' + avgText() + '</div>');
  }
  h += '<label class="field">메모 (선택)<input class="inp" type="text" data-bind="bp.memo" value="' + esc(b.memo) + '" placeholder="예: 커피 마신 뒤, 피곤함"></label>';
  h += '<button class="big-btn" data-act="bpSave">저장하기</button>';
  const list = sortedBp();
  const t = todayStr();
  const todays = list.filter(r => r.ts.slice(0, 10) === t), recent = list.filter(r => r.ts.slice(0, 10) !== t).slice(0, 10);
  const row = r => { const a = readingAvg(r); return '<div class="list-row"><span class="grow"><span class="sub">' + whenLabel(r.ts) + (r.tag ? ' · ' + esc(r.tag) : '') + (r.r.length > 1 ? ' · ' + r.r.length + '회 평균' : '') + '</span><span style="font-size:1.35rem;font-weight:700">' + r0(a.s) + ' / ' + r0(a.d) + (a.p != null ? ' <span class="sub" style="font-weight:400">맥박 ' + r0(a.p) + '</span>' : '') + '</span>' + (r.memo ? '<span class="sub small">' + esc(r.memo) + '</span>' : '') + '</span><button class="back-btn" data-act="bpDel" data-arg="' + r.id + '" aria-label="이 기록 삭제">' + IC.trash + '</button></div>'; };
  h += '<h2>오늘 기록</h2>' + (todays.length ? '<div class="list">' + todays.map(row).join('') + '</div>' : '<div class="empty">오늘 기록이 아직 없어요.</div>');
  if (recent.length) h += '<h2>최근 기록</h2><div class="list">' + recent.map(row).join('') + '</div>';
  return '<main class="page">' + h + '</main>';
}
function bpReadingsFromDraft() {
  const b = UI.bp, out = [];
  const conv = x => ({ s: num(x.s), d: num(x.d), p: num(x.p) });
  const a = conv(b.r[0]); if (a.s != null && a.d != null) out.push(a);
  if (F('bpAvg') && b.two) { const c = conv(b.r[1]); if (c.s != null && c.d != null) out.push(c); }
  return out;
}
function avgText() {
  const rs = bpReadingsFromDraft();
  if (rs.length < 2) return '<span>평균</span><span>두 번 모두 입력하면 계산돼요</span>';
  const a = readingAvg({ r: rs });
  return '<span>평균</span><span style="font-size:1.4rem">' + r0(a.s) + ' / ' + r0(a.d) + (a.p != null ? ' <span style="font-size:1rem">맥박 ' + r0(a.p) + '</span>' : '') + '</span>';
}

/* ---------- 운동 프로그램 ---------- */
function viewProgram() {
  if (UI.progEdit) return viewProgramEdit();
  const p = currentProgram(), idx = D.programs.indexOf(p), t = new Date().getDay();
  let h = '<header class="top"><h1>운동 프로그램</h1><button class="big-btn" style="width:auto;min-height:48px" data-act="progEdit">수정</button></header>';
  if (F('exVersion')) h += '<div class="row wrap"><span class="chip">버전 ' + (idx + 1) + ' · ' + fmtMD(parseYmd(p.start)) + '부터</span>' + (D.programs.length > 1 ? '<button class="link-btn" data-act="toggleVersions">' + (UI.showVersions ? '이전 버전 닫기' : '이전 버전 보기') + '</button>' : '') + '</div>';
  if (UI.showVersions) {
    h += '<div class="list">' + D.programs.map((q, i) => '<div class="list-row"><span class="grow"><b>버전 ' + (i + 1) + '</b><span class="sub">' + fmtMD(parseYmd(q.start)) + '부터 · ' + WEEK_ORDER.filter(d => (q.days[d] || []).length).map(d => DOW[d]).join('·') + '</span></span>' + (q === p ? '<span class="chip">사용 중</span>' : '') + '</div>').join('') + '</div>';
  }
  h += WEEK_ORDER.map(d => {
    const items = (p.days[d] || []).filter(it => it.name);
    const rest = !items.length;
    return '<div class="day-card' + (rest ? ' rest' : '') + (d === t ? ' today' : '') + '"><span class="day-badge">' + DOW[d] + '</span><div style="flex:1;display:flex;flex-direction:column;gap:6px;padding-top:2px">' +
      (rest ? '<span class="sub" style="line-height:40px;font-size:1rem">휴식</span>' : items.map(it => '<div class="row-between"><span style="font-size:1.08rem;font-weight:500">' + esc(it.name) + '</span><span class="sub">' + esc(goalText(it)) + '</span></div>').join('')) + '</div></div>';
  }).join('');
  const A = D.settings.alarms;
  h += '<div class="list"><div class="list-row"><span class="grow"><span>전날 미리 알림</span><span class="sub">' + (A.exEve.on ? A.exEve.time : '꺼짐') + '</span></span></div><div class="list-row"><span class="grow"><span>당일 알림</span><span class="sub">' + (A.exDay.on ? A.exDay.time : '꺼짐') + '</span></span><a class="ghost-btn" href="#settings">알림 설정</a></div></div>';
  return '<main class="page">' + h + '</main>';
}
function viewProgramEdit() {
  const e = UI.progEdit;
  let h = '<header class="top"><h1>프로그램 수정</h1></header>';
  h += '<div class="info-box">요일마다 운동을 넣고, 비워 두면 휴식일이에요. ' + (F('exVersion') ? '저장하면 오늘부터 새 버전으로 적용되고 예전 기록은 그대로 남아요.' : '') + '</div>';
  h += WEEK_ORDER.map(d => {
    const items = e.days[d] || [];
    return card('<div class="row-between"><span class="card-title">' + DOW[d] + '요일</span><span class="sub">' + (items.length ? items.length + '개' : '휴식') + '</span></div>' +
      items.map((it, i) => '<div class="edit-item"><div class="row"><input class="inp" style="flex:1" type="text" placeholder="운동 이름" data-bind="pe.' + d + '.' + i + '.name" value="' + esc(it.name) + '"><button class="back-btn" data-act="peDel" data-arg="' + d + '|' + i + '" aria-label="삭제">' + IC.trash + '</button></div>' +
        '<div class="row"><select class="inp" style="flex:1" data-change="peMetric" data-arg="' + d + '|' + i + '" aria-label="기록 단위"><option value="min"' + (it.metric === 'min' ? ' selected' : '') + '>시간(분)</option><option value="sec"' + (it.metric === 'sec' ? ' selected' : '') + '>버티기(초)</option><option value="reps"' + (it.metric === 'reps' ? ' selected' : '') + '>횟수(회)</option></select>' +
        '<input class="inp" style="width:6.5rem" type="number" inputmode="numeric" placeholder="목표" aria-label="목표" data-bind="pe.' + d + '.' + i + '.goal" value="' + esc(it.goal == null ? '' : it.goal) + '"></div>' +
        (it.metric === 'reps' ? '<label class="row sub">세트 수<input class="inp" style="width:6.5rem" type="number" inputmode="numeric" data-bind="pe.' + d + '.' + i + '.sets" value="' + esc(it.sets == null ? '' : it.sets) + '"></label>' : '') +
        (it.metric === 'min' ? '<label class="row sub"><input type="checkbox" style="width:22px;height:22px" data-change="peDist" data-arg="' + d + '|' + i + '"' + (it.dist ? ' checked' : '') + '> 거리(km)도 기록</label>' : '') +
        '</div>').join('') +
      '<button class="dash-btn" data-act="peAdd" data-arg="' + d + '">+ 운동 추가</button>');
  }).join('');
  h += '<button class="big-btn" data-act="peSave">저장하기</button><button class="ghost-btn" data-act="peCancel">취소</button>';
  return '<main class="page">' + h + '</main>';
}

/* ---------- 통계 ---------- */
function viewStats() {
  let h = '<h1>통계</h1><div class="seg" role="group" aria-label="보기 단위"><button class="' + (UI.statsView === 'week' ? 'on' : '') + '" data-act="statsView" data-arg="week" aria-pressed="' + (UI.statsView === 'week') + '">주간</button><button class="' + (UI.statsView === 'month' ? 'on' : '') + '" data-act="statsView" data-arg="month" aria-pressed="' + (UI.statsView === 'month') + '">월간</button></div>';
  h += UI.statsView === 'week' ? statsWeek() : statsMonth();
  if (F('mixCompare')) h += compareCard();
  if (F('exDetail')) h += growthCard();
  if (F('weight')) h += weightStats();
  if (F('mixStreak')) h += '<div class="grid2"><div class="stat-box"><span class="v" style="color:var(--primary)">' + medStreak() + '일</span><span class="sub">복용 연속</span></div><div class="stat-box accent"><span class="v" style="color:var(--accentText)">' + exWeekStreak() + '주</span><span class="sub">운동 목표 연속 달성</span></div></div>';
  if (F('bpReport')) h += '<a class="big-btn" href="#report">진료용 요약 보기 (최근 4주)</a>';
  if (F('mixExport')) h += '<button class="out-btn" data-act="csv">엑셀(CSV)로 내보내기</button>';
  return '<main class="page">' + h + '</main>';
}
function navRow(act, label, canNext) {
  return '<div class="row-center"><button class="back-btn" data-act="' + act + '" data-arg="-1" aria-label="이전">' + IC.chevL + '</button><span style="font-weight:600">' + label + '</span><button class="back-btn" data-act="' + act + '" data-arg="1" aria-label="다음"' + (canNext ? '' : ' disabled style="opacity:.3"') + '>' + IC.chevR + '</button></div>';
}
function statsWeek() {
  const mon = addDays(mondayOf(new Date()), UI.weekOff * 7), sun = addDays(mon, 6), t = todayStr();
  let h = navRow('weekNav', fmtMD(mon) + ' – ' + fmtMD(sun), UI.weekOff < 0);
  const days = []; for (let i = 0; i < 7; i++) days.push(ymd(addDays(mon, i)));
  if (F('medCheck')) {
    const elapsed = days.filter(d => d <= t && d >= D.created);
    const taken = days.filter(d => D.medLog[d]);
    const rate = elapsed.length ? Math.round(taken.length / elapsed.length * 100) : null;
    const times = taken.map(d => D.medLog[d].time).map(x => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5)));
    const avgT = times.length ? Math.round(mean(times)) : null;
    const late = taken.filter(d => D.medLog[d].time > D.settings.med.end).length;
    h += card('<div class="row-between"><span class="card-title">혈압약</span><span class="sub">' + (avgT != null ? '평균 ' + pad(Math.floor(avgT / 60)) + ':' + pad(avgT % 60) + ' 복용' : '') + '</span></div><div class="row" style="align-items:baseline;gap:8px;flex-wrap:wrap"><span class="stat-num">' + (rate == null ? '–' : rate + '%') + '</span><span class="sub">' + taken.length + ' / ' + elapsed.length + '일 · 늦은 복용 ' + late + '회</span></div><div class="week-grid" style="grid-template-columns:repeat(7,minmax(0,1fr))">' + days.map(d => '<span class="d' + (d === t ? ' today' : '') + '">' + DOW[parseYmd(d).getDay()] + '</span>').join('') + days.map(d => '<span class="dot ' + medStatus(d) + '"></span>').join('') + '</div>');
  }
  const c = weekExCounts(mon);
  const planned = days.filter(d => planFor(d).length);
  let rows = planned.map((d, i) => {
    const st = dayExStatus(d), items = planFor(d), log = exLogFor(d);
    const doneN = items.filter(it => log.items[it.name] && log.items[it.name].done).length;
    const lab = { full: '완료', part: doneN + '/' + items.length, skip: '건너뜀', miss: '못 함', plan: d === t ? '오늘' : '예정' }[st];
    const col = st === 'full' ? 'var(--primary)' : (st === 'part' || st === 'skip' || st === 'miss' ? 'var(--accentText)' : 'var(--sub)');
    return '<div class="row" style="min-height:48px;' + (i < planned.length - 1 ? 'border-bottom:1px solid var(--line)' : '') + '"><span style="width:1.6rem;font-weight:700">' + DOW[parseYmd(d).getDay()] + '</span><span style="flex:1">' + esc(items.map(x => x.name).join(' · ')) + (log.skip ? '<span class="sub small"> · ' + esc(log.skip) + '</span>' : '') + '</span><span style="font-weight:700;color:' + col + '">' + lab + '</span></div>';
  }).join('');
  if (!planned.length) rows = '<div class="empty">이번 주는 계획된 운동이 없어요.</div>';
  const pct = c.planned ? Math.round(c.full / c.planned * 100) : 0;
  h += card('<div class="row-between"><span class="card-title">운동</span><span class="sub">' + (F('exRate') ? '계획 대비' : '') + '</span></div>' + (F('exRate') && c.planned ? '<div class="row" style="align-items:baseline;gap:8px"><span class="stat-num">' + c.full + ' / ' + c.planned + '회</span>' + (c.part ? '<span class="sub">부분 ' + c.part + '회</span>' : '') + '</div><div class="bar"><div style="width:' + pct + '%"></div></div>' : '') + '<div>' + rows + '</div>');
  const rs = bpInRange(days[0], days[6]);
  const am = avgOf(rs.filter(r => slotOf(r) === 'am')), pm = avgOf(rs.filter(r => slotOf(r) === 'pm'));
  const series = s => days.map(d => { const a = avgOf(rs.filter(r => r.ts.slice(0, 10) === d && slotOf(r) === s)); return a ? Math.round(a.s) : null; });
  h += card('<div class="row-between"><span class="card-title">혈압</span><span class="sub">측정 ' + rs.length + '회</span></div><div class="grid2"><div class="stat-box"><span class="sub">아침 평균</span><span class="v">' + (am ? r0(am.s) + ' / ' + r0(am.d) : '–') + '</span></div><div class="stat-box"><span class="sub">저녁 평균</span><span class="v">' + (pm ? r0(pm.s) + ' / ' + r0(pm.d) : '–') + '</span></div></div>' +
    lineChart({ labels: days.map(d => DOW[parseYmd(d).getDay()]), series: [{ data: series('am') }, { data: series('pm') }], goal: F('bpGoal') ? D.settings.bpGoal.s : null, label: '요일별 아침 저녁 수축기 혈압' }) + legend2('아침 (수축기)', '저녁 (수축기)'));
  return h;
}
function statsMonth() {
  const base = new Date(); const first = new Date(base.getFullYear(), base.getMonth() + UI.monthOff, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0), t = todayStr();
  let h = navRow('monthNav', first.getFullYear() + '년 ' + (first.getMonth() + 1) + '월', UI.monthOff < 0);
  let cal = ['월', '화', '수', '목', '금', '토', '일'].map(x => '<span class="h">' + x + '</span>').join('');
  const lead = (first.getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) cal += '<span></span>';
  let medDays = 0, elapsed = 0, exFull = 0, exPlanned = 0;
  for (let n = 1; n <= last.getDate(); n++) {
    const ds = ymd(new Date(first.getFullYear(), first.getMonth(), n));
    const st = dayExStatus(ds), med = !!D.medLog[ds];
    if (ds <= t && ds >= D.created) { elapsed++; if (med) medDays++; }
    if (st !== 'rest' && ds <= t) exPlanned++;
    if (st === 'full') exFull++;
    let cls = st === 'rest' ? (ds > t ? 'future' : '') : (st === 'plan' && ds > t ? 'plan' : st);
    if (st === 'rest' && anyExDone(ds)) cls = 'full';
    cal += '<span class="cell ' + cls + (med ? ' med' : '') + (ds === t ? ' today' : '') + '">' + n + '<i></i></span>';
  }
  h += card('<span class="card-title">한눈에 보기</span><div class="cal">' + cal + '</div><div class="legend"><span><i class="lg-sq" style="background:var(--primary)"></i>운동 완료</span><span><i class="lg-sq" style="border:2px solid var(--primary);background:var(--soft)"></i>일부</span><span><i class="lg-sq" style="border:2px solid var(--accentText)"></i>못 함</span>' + (F('medCheck') ? '<span><i class="lg-sq" style="width:6px;height:6px;border-radius:3px;background:var(--text)"></i>약 복용</span>' : '') + '</div>');
  h += '<div class="grid2">' + (F('medCheck') ? '<div class="stat-box plain"><span class="sub">복용률</span><span class="stat-num">' + (elapsed ? Math.round(medDays / elapsed * 100) + '%' : '–') + '</span><span class="sub small">' + medDays + ' / ' + elapsed + '일</span></div>' : '') + '<div class="stat-box plain"><span class="sub">운동 달성</span><span class="stat-num">' + exFull + ' / ' + exPlanned + '회</span><span class="sub small">지난 계획일 기준</span></div></div>';
  // 12주 추이
  const endMon = mondayOf(last > new Date() ? new Date() : last);
  const weeks = []; for (let i = 11; i >= 0; i--) weeks.push(addDays(endMon, -7 * i));
  const wk = s => weeks.map(m => { const a = avgOf(bpInRange(ymd(m), ymd(addDays(m, 6))).filter(r => slotOf(r) === s)); return a ? Math.round(a.s) : null; });
  const markers = F('medHistory') ? D.medChanges.map(c => { const i = weeks.findIndex(m => c.date >= ymd(m) && c.date <= ymd(addDays(m, 6))); return i >= 0 ? { i: i, label: '약 변경 ' + (parseYmd(c.date).getMonth() + 1) + '/' + parseYmd(c.date).getDate() } : null; }).filter(Boolean) : [];
  h += card('<div class="row-between"><span class="card-title">혈압 추이 · 12주</span><span class="sub">주간 평균</span></div>' + lineChart({ labels: weeks.map(m => (m.getMonth() + 1) + '/' + m.getDate()), series: [{ data: wk('am') }, { data: wk('pm') }], goal: F('bpGoal') ? D.settings.bpGoal.s : null, markers: markers, label: '12주 주간 평균 수축기 혈압' }) + legend2('아침 (수축기)', '저녁 (수축기)'));
  return h;
}
function compareCard() {
  const from = ymd(addDays(new Date(), -59));
  const rs = bpInRange(from, todayStr());
  const ex = avgOf(rs.filter(r => anyExDone(r.ts.slice(0, 10)))), rest = avgOf(rs.filter(r => !anyExDone(r.ts.slice(0, 10))));
  let body;
  if (!ex || !rest) body = '<div class="empty">운동한 날과 쉰 날 기록이 모두 쌓이면 비교해 드려요.</div>';
  else {
    const mx = Math.max(ex.s, rest.s, 1);
    const diff = Math.round(rest.s - ex.s);
    body = '<div class="row-between"><span>운동한 날</span><b>' + r0(ex.s) + ' / ' + r0(ex.d) + '</b></div><div class="bar"><div style="width:' + Math.round(ex.s / mx * 100) + '%"></div></div><div class="row-between"><span>쉰 날</span><b>' + r0(rest.s) + ' / ' + r0(rest.d) + '</b></div><div class="bar alt"><div style="width:' + Math.round(rest.s / mx * 100) + '%"></div></div><span class="sub">' + (diff > 0 ? '운동한 날 수축기가 평균 ' + diff + ' 낮아요' : (diff < 0 ? '운동한 날 수축기가 평균 ' + (-diff) + ' 높아요' : '차이가 거의 없어요')) + ' · 최근 60일, ' + (ex.n + rest.n) + '회 측정</span>';
  }
  return card('<span class="card-title">운동한 날 vs 쉰 날 혈압</span>' + body);
}
function growthCard() {
  const from = ymd(addDays(new Date(), -27));
  const map = {};
  Object.keys(D.exLog).filter(d => d >= from).sort().forEach(d => {
    const items = D.exLog[d].items || {};
    Object.keys(items).forEach(name => {
      const r = items[name]; if (!r || !r.done) return;
      const val = r.km != null ? r.km : r.v; if (val == null) return;
      (map[name] = map[name] || []).push({ d: d, v: val, km: r.km != null });
    });
  });
  Object.keys(map).forEach(n => { if (map[n].some(e => e.km)) map[n] = map[n].filter(e => e.km); });
  const names = Object.keys(map).filter(n => map[n].length >= 2).slice(0, 6);
  const unitOf = (name, isKm) => { if (isKm) return 'km'; for (let i = D.programs.length - 1; i >= 0; i--) for (const k in D.programs[i].days) for (const it of D.programs[i].days[k]) if (it.name === name) return { min: '분', sec: '초', reps: '회' }[it.metric]; return ''; };
  const body = names.length ? names.map((n, i) => { const a = map[n][0], b = map[n][map[n].length - 1], u = unitOf(n, b.km); return '<div class="row-between" style="min-height:44px;' + (i < names.length - 1 ? 'border-bottom:1px solid var(--line)' : '') + '"><span>' + esc(n) + (b.km ? ' (거리)' : '') + '</span><span><span class="sub">' + a.v + u + ' →</span> <b style="color:var(--primary)">' + b.v + u + '</b></span></div>'; }).join('') : '<div class="empty">같은 운동을 두 번 이상 기록하면 변화가 보여요.</div>';
  return card('<span class="card-title">운동 성장 · 4주</span>' + body);
}
function weightStats() {
  const list = D.weight.slice().sort((a, b) => a.date < b.date ? -1 : 1).slice(-30);
  if (list.length < 2) return card('<span class="card-title">체중</span><div class="empty">두 번 이상 기록하면 추이가 보여요.</div>');
  const diff = Math.round((list[list.length - 1].kg - list[0].kg) * 10) / 10;
  return card('<div class="row-between"><span class="card-title">체중</span><span class="sub">' + (diff > 0 ? '+' : '') + diff + 'kg</span></div>' + lineChart({ labels: list.map(w => { const d = parseYmd(w.date); return (d.getMonth() + 1) + '/' + d.getDate(); }), series: [{ data: list.map(w => w.kg) }], label: '체중 추이' }));
}

/* ---------- 진료용 요약 ---------- */
function viewReport() {
  const to = todayStr(), fromD = addDays(new Date(), -27), from = ymd(fromD);
  const rs = bpInRange(from, to).sort((a, b) => a.ts < b.ts ? -1 : 1);
  const am = avgOf(rs.filter(r => slotOf(r) === 'am')), pm = avgOf(rs.filter(r => slotOf(r) === 'pm')), all = avgOf(rs);
  const avgs = rs.map(readingAvg);
  const hi = avgs.length ? avgs.reduce((m, a) => a.s > m.s ? a : m) : null, lo = avgs.length ? avgs.reduce((m, a) => a.s < m.s ? a : m) : null;
  let taken = 0, elapsed = 0;
  for (let i = 0; i < 28; i++) { const d = ymd(addDays(fromD, i)); if (d >= D.created) { elapsed++; if (D.medLog[d]) taken++; } }
  const days = []; for (let i = 0; i < 28; i++) days.push(ymd(addDays(fromD, i)));
  const ser = s => days.map(d => { const a = avgOf(rs.filter(r => r.ts.slice(0, 10) === d && slotOf(r) === s)); return a ? Math.round(a.s) : null; });
  const fmt = a => a ? r0(a.s) + ' / ' + r0(a.d) + (a.p != null ? ' · 맥박 ' + r0(a.p) : '') : '–';
  const m = D.settings.med;
  let h = '<div class="top no-print"><div class="top-back"><a class="back-btn" href="#stats" aria-label="뒤로">' + IC.back + '</a><h1>진료용 요약</h1></div></div>';
  h += '<div><h1 style="font-size:1.5rem">혈압 기록 요약</h1><div class="sub">' + fmtMD(fromD) + ' – ' + fmtMD(new Date()) + ' (최근 4주) · 작성 ' + to + '</div></div>';
  h += card('<span class="card-title">혈압 평균 (mmHg)</span><div class="grid2"><div class="stat-box"><span class="sub">아침</span><span class="v">' + fmt(am) + '</span><span class="sub small">' + (am ? am.n : 0) + '회</span></div><div class="stat-box"><span class="sub">저녁</span><span class="v">' + fmt(pm) + '</span><span class="sub small">' + (pm ? pm.n : 0) + '회</span></div></div><div class="sub">전체 ' + rs.length + '회 평균 ' + fmt(all) + (hi ? ' · 최고 ' + r0(hi.s) + '/' + r0(hi.d) + ' · 최저 ' + r0(lo.s) + '/' + r0(lo.d) : '') + '</div>' + lineChart({ labels: days.map(d => { const x = parseYmd(d); return (x.getMonth() + 1) + '/' + x.getDate(); }), series: [{ data: ser('am') }, { data: ser('pm') }], goal: F('bpGoal') ? D.settings.bpGoal.s : null, label: '최근 4주 아침 저녁 수축기 혈압' }) + legend2('아침 (수축기)', '저녁 (수축기)'));
  h += card('<span class="card-title">복약</span><div>' + esc(m.name) + (m.dose ? ' · ' + esc(m.dose) : '') + ' · 복용 시간 ' + m.start + '–' + m.end + '</div><div>복용률 <b>' + (elapsed ? Math.round(taken / elapsed * 100) : 0) + '%</b> (' + taken + ' / ' + elapsed + '일)</div>' + (F('medHistory') && D.medChanges.length ? '<div class="sub">약 변경: ' + D.medChanges.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(c => c.date + ' ' + esc(c.text)).join(' / ') + '</div>' : ''));
  h += card('<span class="card-title">측정 기록</span>' + (rs.length ? '<table class="rep"><thead><tr><th>날짜·시각</th><th>상황</th><th>혈압</th><th>맥박</th></tr></thead><tbody>' + rs.map(r => { const a = readingAvg(r); return '<tr><td>' + r.ts.slice(5, 10).replace('-', '/') + ' ' + r.ts.slice(11, 16) + '</td><td>' + esc(r.tag || '') + '</td><td><b>' + r0(a.s) + '/' + r0(a.d) + '</b>' + (r.r.length > 1 ? ' (' + r.r.length + '회 평균)' : '') + '</td><td>' + (a.p != null ? r0(a.p) : '') + '</td></tr>'; }).join('') + '</tbody></table>' : '<div class="empty">이 기간에 기록이 없어요.</div>'));
  h += '<button class="big-btn no-print" data-act="print">PDF로 저장 · 인쇄</button><div class="sub small no-print">인쇄 화면에서 프린터를 ‘PDF로 저장’으로 고르면 파일로 저장돼요.</div>';
  return '<main class="page">' + h + '</main>';
}

/* ---------- 기능 켜기/끄기 ---------- */
function viewFeatures() {
  const on = Object.values(D.settings.features).filter(Boolean).length;
  let h = '<div><h1>기능 설정</h1><p class="sub" style="margin:6px 0 0">켜 둔 기능만 화면에 나타나요. 지금 ' + on + '개 켜짐.</p></div>';
  h += '<a class="list-link soft" href="#settings">알림 시간 · 화면 · 약 정보<span aria-hidden="true">›</span></a>';
  h += '<a class="list-link" href="#data">데이터 백업 · 복원 · 삭제<span aria-hidden="true">›</span></a>';
  h += FEATURE_DEFS.map(g => '<h2>' + g.group + '</h2><div class="list">' + g.items.map(it => '<div class="list-row"><span class="grow"><span style="font-weight:500">' + it[1] + '</span><span class="sub small">' + it[2] + '</span></span>' + toggleBtn(F(it[0]), 'feat', it[0], it[1]) + '</div>').join('') + '</div>').join('');
  return '<main class="page">' + h + '</main>';
}

/* ---------- 알림 · 화면 설정 ---------- */
function alarmPlan() {
  const A = D.settings.alarms, p = currentProgram(), list = [];
  const exDays = [0, 1, 2, 3, 4, 5, 6].filter(d => (p.days[d] || []).some(it => it.name));
  const medName = D.settings.med.name || '혈압약';
  if (F('medCheck') && A.med.on) list.push({ time: A.med.time, days: null, title: medName + ' 복용' });
  if (F('medCheck') && F('medRemind') && A.medAgain.on) list.push({ time: A.medAgain.time, days: null, title: medName + ' 드셨나요? (재알림)' });
  if (A.bpAm.on) list.push({ time: A.bpAm.time, days: null, title: '아침 혈압 측정' });
  if (A.bpPm.on) list.push({ time: A.bpPm.time, days: null, title: '자기 전 혈압 측정' });
  if (A.exEve.on && exDays.length) list.push({ time: A.exEve.time, days: exDays.map(d => (d + 6) % 7), title: '내일 운동 미리보기', eve: true });
  if (A.exDay.on && exDays.length) list.push({ time: A.exDay.time, days: exDays, title: '오늘 운동', ex: true });
  return list.sort((a, b) => a.time < b.time ? -1 : 1);
}
const daysLabel = days => days ? WEEK_ORDER.filter(d => days.indexOf(d) >= 0).map(d => DOW[d]).join('·') : '매일';
function viewSettings() {
  const s = D.settings, A = s.alarms;
  let h = backHead('#features', '알림 · 화면');
  h += '<h2>알림 시간</h2>';
  h += '<div class="list">' + ALARM_DEFS.filter(a => (!a[3] || F(a[3])) && (a[0].indexOf('med') !== 0 || F('medCheck'))).map(a => '<div class="list-row"><span class="grow"><span style="font-weight:500">' + a[1] + '</span><span class="sub small">' + a[2] + '</span></span><input class="inp-time" type="time" aria-label="' + a[1] + ' 시간" data-change="alarmTime" data-arg="' + a[0] + '" value="' + A[a[0]].time + '">' + toggleBtn(A[a[0]].on, 'alarmToggle', a[0], a[1] + ' 켜기') + '</div>').join('') + '</div>';
  const plan = alarmPlan();
  h += card('<span class="card-title">휴대폰 알람 등록</span><div class="info-box">웹앱은 화면이 닫혀 있을 때 스스로 알람을 울릴 수 없어요. 아래 목록대로 <b>휴대폰 시계 앱</b>에 알람을 만들거나, 캘린더 파일을 받아 캘린더에 가져오세요.</div>' +
    (plan.length ? '<div>' + plan.map((x, i) => '<div class="row-between" style="min-height:44px;' + (i < plan.length - 1 ? 'border-bottom:1px solid var(--line)' : '') + '"><span><b>' + x.time + '</b> · ' + esc(x.title) + '</span><span class="sub">' + daysLabel(x.days) + '</span></div>').join('') + '</div>' : '<div class="empty">켜진 알림이 없어요.</div>') +
    '<button class="out-btn" data-act="ics">캘린더 파일(.ics) 받기</button>');
  h += '<h2>화면 테마</h2><div class="grid2">' + THEMES.map(t => '<button type="button" class="theme-card' + (s.theme === t.id ? ' on' : '') + '" aria-pressed="' + (s.theme === t.id) + '" data-act="theme" data-arg="' + t.id + '"><span class="row" style="gap:6px">' + t.c.map(c => '<span class="sw" style="background:' + c + '"></span>').join('') + '</span><b>' + t.name + '</b></button>').join('') + '</div>';
  h += '<div class="list"><div class="list-row"><span class="grow"><span style="font-weight:500">낮 · 밤 자동 전환</span><span class="sub small">밤에는 D(다크)로 바뀌어요</span></span>' + toggleBtn(s.autoNight, 'autoNight', '', '낮 밤 자동 전환') + '</div><div class="list-row" style="' + (s.autoNight ? '' : 'opacity:.45') + '"><span class="grow">밤 시간</span><input class="inp-time" type="time" aria-label="밤 시작" data-change="nightStart" value="' + s.nightStart + '"><span>–</span><input class="inp-time" type="time" aria-label="밤 끝" data-change="nightEnd" value="' + s.nightEnd + '"></div></div>';
  h += '<h2>글자 크기</h2><div class="seg" role="group" aria-label="글자 크기">' + [['normal', '보통'], ['large', '크게'], ['xlarge', '아주 크게']].map(f => '<button class="' + (s.font === f[0] ? 'on' : '') + '" aria-pressed="' + (s.font === f[0]) + '" data-act="font" data-arg="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';
  if (F('bpGoal')) h += '<h2>혈압 목표 (의사와 정한 값)</h2>' + card('<div class="grid2"><label class="field">수축기 목표<input class="inp" type="number" inputmode="numeric" data-change="goal" data-arg="s" value="' + esc(s.bpGoal.s == null ? '' : s.bpGoal.s) + '" placeholder="예: 135"></label><label class="field">이완기 목표<input class="inp" type="number" inputmode="numeric" data-change="goal" data-arg="d" value="' + esc(s.bpGoal.d == null ? '' : s.bpGoal.d) + '" placeholder="예: 85"></label></div><span class="sub small">그래프에 수축기 목표선으로 표시돼요.</span>');
  h += '<a class="list-link" href="#med">약 정보 · 복용 기록 고치기<span aria-hidden="true">›</span></a>';
  h += '<a class="list-link" href="#data">데이터 백업 · 복원 · 삭제<span aria-hidden="true">›</span></a>';
  h += '<div class="sub small" style="text-align:center">내 건강 기록 v' + APP_VERSION + '</div>';
  return '<main class="page">' + h + '</main>';
}

/* ---------- 약 정보 ---------- */
function viewMed() {
  const m = D.settings.med;
  let h = backHead('#settings', '약 정보');
  h += card('<label class="field">약 이름<input class="inp" type="text" data-change="medField" data-arg="name" value="' + esc(m.name) + '"></label><label class="field">용량 · 메모 (선택)<input class="inp" type="text" data-change="medField" data-arg="dose" value="' + esc(m.dose) + '" placeholder="예: 5mg 1알"></label><div class="grid2"><label class="field">복용 시작<input class="inp" type="time" data-change="medField" data-arg="start" value="' + m.start + '"></label><label class="field">복용 끝<input class="inp" type="time" data-change="medField" data-arg="end" value="' + m.end + '"></label></div><span class="sub small">끝 시각 이후에 체크하면 ‘늦게 복용’으로 표시돼요.</span>');
  if (F('medStock')) {
    const r = medRemaining();
    h += '<h2>남은 약</h2>' + card('<div class="row-between"><span>지금 남은 약</span><b style="font-size:1.4rem">' + (r == null ? '–' : r + '일분') + '</b></div><div class="grid2"><label class="field">남은 알약 수 (오늘 기준)<input class="inp" type="number" inputmode="numeric" id="stock-in" placeholder="예: 30"></label><label class="field">알림 기준 (일)<input class="inp" type="number" inputmode="numeric" data-change="medField" data-arg="warnDays" value="' + m.warnDays + '"></label></div><button class="out-btn" data-act="stockSave">남은 약 수 저장</button><span class="sub small">새로 처방받으면 남은 알약 수를 다시 입력하세요. 하루 1알 기준으로 계산해요.</span>');
  }
  h += '<h2>복용 기록 고치기</h2>' + card('<div class="grid2"><label class="field">날짜<input class="inp" type="date" id="fix-date" max="' + todayStr() + '" value="' + todayStr() + '"></label><label class="field">복용 시각<input class="inp" type="time" id="fix-time" value="' + m.start + '"></label></div><div class="grid2"><button class="big-btn" data-act="medFix">복용으로 저장</button><button class="ghost-btn" data-act="medFixDel">기록 지우기</button></div>' +
    '<div>' + (() => { let s = ''; for (let i = 0; i < 7; i++) { const d = ymd(addDays(new Date(), -i)), l = D.medLog[d]; s += '<div class="row-between" style="min-height:40px"><span>' + fmtMD(parseYmd(d)) + ' ' + DOW[parseYmd(d).getDay()] + '</span><span class="' + (l ? 'b' : 'sub') + '">' + (l ? l.time : '기록 없음') + '</span></div>'; } return s; })() + '</div>');
  if (F('medHistory')) {
    const list = D.medChanges.slice().sort((a, b) => a.date < b.date ? 1 : -1);
    h += '<h2>약 변경 이력</h2>' + card((list.length ? '<div>' + list.map(c => '<div class="row-center" style="min-height:48px;border-bottom:1px solid var(--line)"><span><b>' + c.date + '</b> · ' + esc(c.text) + '</span><button class="back-btn" data-act="chgDel" data-arg="' + c.id + '" aria-label="삭제">' + IC.trash + '</button></div>').join('') + '</div>' : '<div class="empty">아직 변경 이력이 없어요.</div>') +
      '<label class="field">변경일<input class="inp" type="date" id="chg-date" value="' + todayStr() + '"></label><label class="field">내용<input class="inp" type="text" id="chg-text" placeholder="예: 5mg → 10mg으로 증량"></label><button class="out-btn" data-act="chgAdd">변경 이력 추가</button>');
  }
  return '<main class="page">' + h + '</main>';
}

/* ---------- 데이터 관리 ---------- */
function viewData() {
  const s = D.settings;
  const counts = [['혈압 기록', D.bp.length], ['복용일', Object.keys(D.medLog).length], ['운동일', Object.keys(D.exLog).filter(anyExDone).length]];
  let h = backHead('#features', '데이터 관리');
  h += card('<div class="row" style="align-items:flex-start;gap:12px"><span class="check-circle" style="background:var(--soft);color:var(--primary)">' + IC.phone + '</span><span style="display:flex;flex-direction:column;gap:2px"><b style="font-size:1.05rem">기록은 이 기기에만 저장돼요</b><span class="sub">서버나 다른 사람에게 보내지 않아요. 이 브라우저(크롬)의 앱 저장공간에 있어요.</span></span></div><div class="grid3">' + counts.map(c => '<span class="stat-box" style="align-items:center;background:var(--bg)"><b style="font-size:1.3rem">' + c[1] + '</b><span class="sub small">' + c[0] + '</span></span>').join('') + '</div><div class="row-between"><span class="sub">자동 삭제 방지 (영구 저장)</span><span class="chip">' + (UI.persisted == null ? '확인 중' : (UI.persisted ? '켜짐' : '대기 중')) + '</span></div>');
  const since = s.lastBackup ? daysBetween(s.lastBackup, todayStr()) : null;
  h += '<h2>백업</h2>' + card('<div class="warn-box"><b>' + (s.lastBackup ? '마지막 백업 ' + (since === 0 ? '오늘' : since + '일 전') : '아직 백업한 적이 없어요') + '</b><span class="sub">' + (s.lastBackup ? s.lastBackup : '첫 백업을 해 두세요') + '</span></div><button class="big-btn" data-act="backup">지금 백업하기</button><span class="sub">기기의 <b>다운로드</b> 폴더에 파일로 저장돼요. 예: 건강기록_' + todayStr() + '.json</span><div class="field">백업 알림<div class="seg" role="group" aria-label="백업 알림 주기">' + [[0, '끔'], [14, '2주'], [30, '1달']].map(c => '<button class="' + (s.backupDays === c[0] ? 'on' : '') + '" aria-pressed="' + (s.backupDays === c[0]) + '" data-act="backupCycle" data-arg="' + c[0] + '">' + c[1] + '</button>').join('') + '</div></div>');
  h += '<h2>복원</h2>' + card('<button class="out-btn" data-act="restorePick">백업 파일 불러오기</button><input type="file" accept=".json,application/json" class="hidden-input" id="restore-file" data-change="restoreFile" tabindex="-1" aria-hidden="true"><span class="sub">새 기기로 옮길 때나 기록이 지워졌을 때 써요. 불러온 뒤 방식을 고를 수 있어요.</span><div class="sub"><b style="color:var(--text)">합치기</b> · 지금 기록은 두고 빠진 것만 추가<br><b style="color:var(--text)">덮어쓰기</b> · 지금 기록을 지우고 백업으로 교체</div>');
  const notes = [
    ['크롬 기록 삭제 때 주의', '“인터넷 사용 기록 삭제”에서 ‘쿠키 및 사이트 데이터’를 체크하면 앱 기록도 지워져요. 방문 기록·캐시만 지우는 건 괜찮아요.'],
    ['이런 경우에도 지워져요', '크롬 사이트 설정의 ‘삭제 및 재설정’, 휴대폰 설정 → 애플리케이션 → Chrome → 저장공간 → ‘데이터 삭제’.'],
    ['아이콘만 지우면 남아요', '홈 화면 아이콘을 지워도 기록은 남을 수 있어요. 완전히 지우려면 아래 ‘모든 데이터 삭제’를 쓰세요.'],
    ['기기를 바꿀 때', '백업 파일을 새 기기로 옮긴 뒤 ‘백업 파일 불러오기’로 복원하세요. 휴대폰과 태블릿의 기록은 자동으로 합쳐지지 않아요.'],
    ['백업 파일 보관', '건강 기록이 들어 있어요. 다른 사람에게 보내지 말고, 클라우드에 올릴 땐 내 계정에만 두세요.']
  ];
  h += '<h2>꼭 알아 두세요</h2><div class="list">' + notes.map((n, i) => '<div class="note-row"><span class="num-badge">' + (i + 1) + '</span><span style="display:flex;flex-direction:column;gap:2px"><b>' + n[0] + '</b><span class="sub">' + n[1] + '</span></span></div>').join('') + '</div>';
  h += '<h2>삭제</h2>' + card('<span style="font-weight:500">골라서 지우기</span><div class="grid2">' + [['bp', '혈압 기록'], ['med', '복용 기록'], ['ex', '운동 기록'], ['weight', '체중 기록']].map(x => '<button class="ghost-btn" data-act="delPart" data-arg="' + x[0] + '">' + x[1] + '</button>').join('') + '</div><button class="danger-btn" data-act="delAllAsk">모든 데이터 삭제</button><span class="sub small">앱까지 없애려면 여기서 삭제한 다음 홈 화면 아이콘을 지우세요.</span>');
  return '<main class="page">' + h + '</main>';
}

/* ---------- 모달 ---------- */
function modalHtml() {
  const m = UI.modal; if (!m) return '';
  let inner = '';
  if (m.type === 'ex') {
    const it = m.item, f = UI.form;
    inner = '<h3>' + esc(it.name) + '</h3><div class="sub">' + fmtKDate(parseYmd(m.ds)) + ' · ' + esc(goalText(it)) + '</div>';
    if (it.metric === 'min') inner += '<div class="grid2"><label class="field">운동 시간 (분)<input class="inp num-mid" type="number" inputmode="numeric" data-bind="f.v" value="' + esc(f.v) + '"></label>' + (it.dist ? '<label class="field">거리 (km)<input class="inp num-mid" type="number" inputmode="decimal" step="0.1" data-bind="f.km" value="' + esc(f.km) + '"></label>' : '') + '</div>';
    if (it.metric === 'sec') inner += '<label class="field">버틴 시간 (초)<input class="inp num-mid" type="number" inputmode="numeric" data-bind="f.v" value="' + esc(f.v) + '"></label>';
    if (it.metric === 'reps') inner += '<div class="grid2"><label class="field">횟수 (회)<input class="inp num-mid" type="number" inputmode="numeric" data-bind="f.v" value="' + esc(f.v) + '"></label><label class="field">세트<input class="inp num-mid" type="number" inputmode="numeric" data-bind="f.sets" value="' + esc(f.sets) + '"></label></div>';
    inner += '<span class="sub small">숫자는 비워 둬도 완료로 저장돼요.</span><button class="big-btn" data-act="exSave">완료로 저장</button>' + (m.existing ? '<button class="ghost-btn" data-act="exClear">완료 취소</button>' : '') + '<button class="link-btn" data-act="closeModal">닫기</button>';
  } else if (m.type === 'skip') {
    inner = '<h3>오늘 운동 건너뛰기</h3><div class="tags">' + SKIP_REASONS.map(r => '<button class="tag' + (UI.form.reason === r ? ' on' : '') + '" data-act="skipReason" data-arg="' + r + '">' + r + '</button>').join('') + '</div><label class="field">메모 (선택)<input class="inp" type="text" data-bind="f.note" value="' + esc(UI.form.note) + '" placeholder="예: 러닝만 하고 쉼"></label><button class="big-btn" data-act="skipSave">저장</button>' + (exLogFor(m.ds).skip ? '<button class="ghost-btn" data-act="skipClear">건너뜀 취소</button>' : '') + '<button class="link-btn" data-act="closeModal">닫기</button>';
  } else if (m.type === 'weight') {
    inner = '<h3>체중 기록</h3><label class="field">오늘 체중 (kg)<input class="inp num-input" type="number" inputmode="decimal" step="0.1" data-bind="f.kg" value="' + esc(UI.form.kg) + '"></label><button class="big-btn" data-act="weightSave">저장</button><button class="link-btn" data-act="closeModal">닫기</button>';
  } else if (m.type === 'confirm') {
    inner = '<div class="danger-box"><span class="t">' + esc(m.title) + '</span><span>' + esc(m.body) + '</span><button class="danger-btn" data-act="confirmYes">' + esc(m.yes || '삭제') + '</button><button class="ghost-btn" data-act="closeModal">취소</button></div>';
  } else if (m.type === 'delAll') {
    inner = '<div class="danger-box"><span class="t">정말 모두 지울까요?</span><span>혈압 ' + D.bp.length + '건, 복용 ' + Object.keys(D.medLog).length + '일, 운동 기록과 설정이 모두 지워지고 되돌릴 수 없어요.</span><button class="big-btn" data-act="delAll" data-arg="backup">백업하고 삭제</button><button class="danger-btn" data-act="delAll" data-arg="now">백업 없이 바로 삭제</button><button class="ghost-btn" data-act="closeModal">취소</button></div>';
  } else if (m.type === 'restore') {
    const r = UI.restoreData;
    inner = '<h3>백업 불러오기</h3><div class="info-box">' + esc(m.fileName) + '<br>혈압 ' + r.bp.length + '건 · 복용 ' + Object.keys(r.medLog).length + '일 · 운동 ' + Object.keys(r.exLog).length + '일</div><button class="big-btn" data-act="restoreDo" data-arg="merge">합치기</button><button class="danger-btn" data-act="restoreDo" data-arg="replace">덮어쓰기</button><button class="link-btn" data-act="closeModal">취소</button>';
  }
  return '<div class="modal-back" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true">' + inner + '</div></div>';
}

/* ---------- 렌더 ---------- */
const VIEWS = { today: viewToday, record: viewRecord, program: viewProgram, stats: viewStats, features: viewFeatures, settings: viewSettings, med: viewMed, data: viewData, report: viewReport };
function route() { const r = (location.hash || '#today').slice(1); return VIEWS[r] ? r : 'today'; }
function isNight() {
  const s = D.settings, n = nowHM();
  return s.nightStart > s.nightEnd ? (n >= s.nightStart || n < s.nightEnd) : (n >= s.nightStart && n < s.nightEnd);
}
function activeTheme() { return D.settings.autoNight && isNight() ? 'D' : D.settings.theme; }
function applyTheme() {
  const th = activeTheme(), el = document.documentElement;
  el.dataset.theme = th; el.dataset.font = D.settings.font;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', { A: '#F6F4EE', B: '#F4F5F7', C: '#F7F6FA', D: '#1E2226' }[th]);
}
let lastRenderKey = '';
function render() {
  applyTheme();
  const r = route();
  const y = window.scrollY;
  document.getElementById('app').innerHTML = VIEWS[r]() + (r === 'report' ? '' : nav(r)) + modalHtml() + (UI.toast ? '<div class="toast" role="status">' + esc(UI.toast) + '</div>' : '');
  window.scrollTo(0, y);
  lastRenderKey = todayStr() + activeTheme();
}
let toastTimer = null;
function toast(msg) { UI.toast = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(() => { UI.toast = null; render(); }, 2200); }
function openModal(m) { UI.modal = m; render(); }
function closeModal() { UI.modal = null; render(); }

/* ---------- 파일 저장 ---------- */
function download(name, text, type) {
  const blob = new Blob([text], { type: type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function doBackup() {
  download('건강기록_' + todayStr() + '.json', JSON.stringify({ app: 'my-health-record', version: APP_VERSION, exportedAt: new Date().toISOString(), data: D }, null, 1), 'application/json');
  D.settings.lastBackup = todayStr(); save();
}
function csvExport() {
  const q = v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['구분', '날짜', '시각', '항목', '값1', '값2', '값3', '메모']];
  sortedBp().reverse().forEach(r => { const a = readingAvg(r); rows.push(['혈압', r.ts.slice(0, 10), r.ts.slice(11, 16), r.tag || '', Math.round(a.s), Math.round(a.d), a.p != null ? Math.round(a.p) : '', (r.r.length > 1 ? r.r.length + '회 평균 ' : '') + (r.memo || '')]); });
  Object.keys(D.medLog).sort().forEach(d => rows.push(['복용', d, D.medLog[d].time, D.settings.med.name, '', '', '', '']));
  Object.keys(D.exLog).sort().forEach(d => { const l = D.exLog[d]; Object.keys(l.items || {}).forEach(n => { const r = l.items[n]; if (r && r.done) rows.push(['운동', d, '', n, r.v != null ? r.v : '', r.km != null ? r.km + 'km' : '', r.sets != null ? r.sets + '세트' : '', '']); }); if (l.skip) rows.push(['운동 건너뜀', d, '', l.skip, '', '', '', l.note || '']); });
  D.weight.slice().sort((a, b) => a.date < b.date ? -1 : 1).forEach(w => rows.push(['체중', w.date, '', 'kg', w.kg, '', '', '']));
  D.medChanges.forEach(c => rows.push(['약 변경', c.date, '', c.text, '', '', '', '']));
  download('건강기록_' + todayStr() + '.csv', '﻿' + rows.map(r => r.map(q).join(',')).join('\r\n'), 'text/csv');
}
function icsExport() {
  const plan = alarmPlan(); if (!plan.length) { toast('켜진 알림이 없어요'); return; }
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const p = currentProgram();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const ev = [];
  const firstDate = dow => { let d = addDays(new Date(), 1); if (dow == null) return d; while (d.getDay() !== dow) d = addDays(d, 1); return d; };
  const push = (title, desc, time, dow) => {
    const d = firstDate(dow), dt = ymd(d).replace(/-/g, '') + 'T' + time.replace(':', '') + '00';
    ev.push(['BEGIN:VEVENT', 'UID:' + uid() + '@my-health-record', 'DTSTAMP:' + stamp, 'DTSTART:' + dt, 'DURATION:PT10M', 'RRULE:' + (dow == null ? 'FREQ=DAILY' : 'FREQ=WEEKLY;BYDAY=' + BY[dow]), 'SUMMARY:' + title, desc ? 'DESCRIPTION:' + desc : '', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + title, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT'].filter(Boolean).join('\r\n'));
  };
  plan.forEach(x => {
    if (!x.days) push(x.title, '', x.time, null);
    else x.days.forEach(dw => { const target = x.eve ? (dw + 1) % 7 : dw; const items = (p.days[target] || []).filter(it => it.name).map(itemLabel).join(', '); push(x.title, items, x.time, dw); });
  });
  download('건강기록_알림.ics', ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//my-health-record//KO', 'X-WR-CALNAME:내 건강 기록', 'CALSCALE:GREGORIAN'].join('\r\n') + '\r\n' + ev.join('\r\n') + '\r\nEND:VCALENDAR\r\n', 'text/calendar');
}

/* ---------- 동작 ---------- */
const ACT = {
  backdrop: (a, el, e) => { if (e.target === el) closeModal(); },
  closeModal: () => closeModal(),
  medTake: () => { D.medLog[todayStr()] = { time: nowHM() }; save(); toast('복용 완료를 기록했어요'); },
  medUndo: () => { delete D.medLog[todayStr()]; save(); render(); },
  bpTag: a => { UI.bp.tag = UI.bp.tag === a ? '' : a; render(); },
  bpTwo: () => { UI.bp.two = true; render(); },
  bpOne: () => { UI.bp.two = false; UI.bp.r[1] = { s: '', d: '', p: '' }; render(); },
  bpSave: () => {
    const rs = bpReadingsFromDraft();
    if (!rs.length) { toast('수축기와 이완기를 입력해 주세요'); return; }
    if (rs.some(x => x.s < 50 || x.s > 260 || x.d < 30 || x.d > 180)) { toast('숫자를 다시 확인해 주세요'); return; }
    D.bp.push({ id: uid(), ts: UI.bp.ts || nowLocalDT(), tag: F('bpTag') ? UI.bp.tag : '', r: rs, memo: UI.bp.memo.trim() });
    save(); UI.bp = newBpDraft(); toast('저장했어요');
  },
  bpDel: a => openModal({ type: 'confirm', title: '이 혈압 기록을 지울까요?', body: '지운 기록은 되돌릴 수 없어요.', onYes: () => { D.bp = D.bp.filter(r => r.id !== a); save(); } }),
  confirmYes: () => { const fn = UI.modal.onYes; UI.modal = null; fn(); render(); },
  exOpen: a => {
    const p = a.split('|'), ds = p[0], it = planFor(ds)[Number(p[1])]; if (!it) return;
    const log = exLogFor(ds), r = log.items[it.name];
    if (!F('exDetail')) {
      const l = D.exLog[ds] = D.exLog[ds] || { items: {}, skip: '' };
      if (r && r.done) delete l.items[it.name]; else { l.items[it.name] = { done: true }; l.skip = ''; }
      save(); render(); return;
    }
    UI.form = { v: r && r.v != null ? r.v : (it.goal != null && it.metric !== 'reps' ? it.goal : (it.metric === 'reps' && it.goal != null ? it.goal : '')), km: r && r.km != null ? r.km : '', sets: r && r.sets != null ? r.sets : (it.sets != null ? it.sets : '') };
    openModal({ type: 'ex', ds: ds, item: it, existing: !!(r && r.done) });
  },
  exSave: () => {
    const m = UI.modal, l = D.exLog[m.ds] = D.exLog[m.ds] || { items: {}, skip: '' };
    l.items[m.item.name] = { done: true, v: num(UI.form.v), km: m.item.dist ? num(UI.form.km) : null, sets: m.item.metric === 'reps' ? num(UI.form.sets) : null };
    l.skip = ''; save(); UI.modal = null; toast('운동을 기록했어요');
  },
  exClear: () => { const m = UI.modal; if (D.exLog[m.ds]) delete D.exLog[m.ds].items[m.item.name]; save(); closeModal(); },
  exSkip: a => { const l = exLogFor(a); UI.form = { reason: l.skip || '', note: l.note || '' }; openModal({ type: 'skip', ds: a }); },
  skipReason: a => { UI.form.reason = a; render(); },
  skipSave: () => { if (!UI.form.reason) { toast('사유를 골라 주세요'); return; } const ds = UI.modal.ds, l = D.exLog[ds] = D.exLog[ds] || { items: {}, skip: '' }; l.skip = UI.form.reason; l.note = (UI.form.note || '').trim(); save(); closeModal(); },
  skipClear: () => { const ds = UI.modal.ds; if (D.exLog[ds]) { D.exLog[ds].skip = ''; D.exLog[ds].note = ''; } save(); closeModal(); },
  weightOpen: () => { const w = D.weight.find(x => x.date === todayStr()); UI.form = { kg: w ? w.kg : '' }; openModal({ type: 'weight' }); },
  weightSave: () => { const kg = num(UI.form.kg); if (kg == null || kg < 20 || kg > 300) { toast('체중을 확인해 주세요'); return; } D.weight = D.weight.filter(x => x.date !== todayStr()); D.weight.push({ date: todayStr(), kg: Math.round(kg * 10) / 10 }); save(); UI.modal = null; toast('저장했어요'); },
  progEdit: () => { const p = currentProgram(); const days = {}; for (let d = 0; d < 7; d++) days[d] = JSON.parse(JSON.stringify(p.days[d] || [])); UI.progEdit = { days: days }; render(); window.scrollTo(0, 0); },
  toggleVersions: () => { UI.showVersions = !UI.showVersions; render(); },
  peAdd: a => { UI.progEdit.days[a].push({ name: '', metric: 'min', goal: null, dist: false }); render(); },
  peDel: a => { const p = a.split('|'); UI.progEdit.days[p[0]].splice(Number(p[1]), 1); render(); },
  peCancel: () => { UI.progEdit = null; render(); window.scrollTo(0, 0); },
  peSave: () => {
    const days = {};
    for (let d = 0; d < 7; d++) days[d] = (UI.progEdit.days[d] || []).map(it => ({ name: String(it.name || '').trim(), metric: it.metric, goal: num(it.goal), sets: it.metric === 'reps' ? num(it.sets) : undefined, dist: it.metric === 'min' ? !!it.dist : undefined })).filter(it => it.name);
    const cur = currentProgram(), t = todayStr();
    if (!F('exVersion') || cur.start === t) cur.days = days;
    else D.programs.push({ id: uid(), start: t, days: days });
    save(); UI.progEdit = null; toast('프로그램을 저장했어요'); window.scrollTo(0, 0);
  },
  statsView: a => { UI.statsView = a; render(); },
  weekNav: a => { UI.weekOff = Math.min(0, UI.weekOff + Number(a)); render(); },
  monthNav: a => { UI.monthOff = Math.min(0, UI.monthOff + Number(a)); render(); },
  csv: () => { csvExport(); toast('다운로드 폴더에 저장했어요'); },
  print: () => window.print(),
  feat: a => { D.settings.features[a] = !D.settings.features[a]; save(); render(); },
  alarmToggle: a => { D.settings.alarms[a].on = !D.settings.alarms[a].on; save(); render(); },
  ics: () => { icsExport(); toast('캘린더 파일을 저장했어요'); },
  theme: a => { D.settings.theme = a; save(); render(); },
  autoNight: () => { D.settings.autoNight = !D.settings.autoNight; save(); render(); },
  font: a => { D.settings.font = a; save(); render(); },
  stockSave: () => { const v = num(document.getElementById('stock-in').value); if (v == null || v < 0) { toast('알약 수를 입력해 주세요'); return; } D.settings.med.stock = Math.round(v); D.settings.med.stockDate = D.medLog[todayStr()] ? ymd(addDays(new Date(), 1)) : todayStr(); save(); toast('남은 약 수를 저장했어요'); },
  medFix: () => { const d = document.getElementById('fix-date').value, t = document.getElementById('fix-time').value; if (!d || d > todayStr()) { toast('날짜를 확인해 주세요'); return; } D.medLog[d] = { time: t || D.settings.med.start }; save(); toast(fmtMD(parseYmd(d)) + ' 복용으로 저장했어요'); },
  medFixDel: () => { const d = document.getElementById('fix-date').value; if (D.medLog[d]) { delete D.medLog[d]; save(); toast('기록을 지웠어요'); } else toast('그 날짜엔 기록이 없어요'); },
  chgAdd: () => { const d = document.getElementById('chg-date').value, t = document.getElementById('chg-text').value.trim(); if (!d || !t) { toast('날짜와 내용을 입력해 주세요'); return; } D.medChanges.push({ id: uid(), date: d, text: t }); save(); toast('추가했어요'); },
  chgDel: a => { D.medChanges = D.medChanges.filter(c => c.id !== a); save(); render(); },
  backup: () => { doBackup(); toast('다운로드 폴더에 백업했어요'); },
  backupCycle: a => { D.settings.backupDays = Number(a); save(); render(); },
  restorePick: () => document.getElementById('restore-file').click(),
  restoreDo: a => {
    const r = UI.restoreData;
    if (a === 'replace') D = migrate(r);
    else {
      Object.keys(r.medLog).forEach(k => { if (!D.medLog[k]) D.medLog[k] = r.medLog[k]; });
      Object.keys(r.exLog).forEach(k => { if (!D.exLog[k]) D.exLog[k] = r.exLog[k]; });
      const ids = new Set(D.bp.map(x => x.id)); r.bp.forEach(x => { if (!ids.has(x.id)) D.bp.push(x); });
      const cids = new Set(D.medChanges.map(x => x.id)); r.medChanges.forEach(x => { if (!cids.has(x.id)) D.medChanges.push(x); });
      const wd = new Set(D.weight.map(x => x.date)); r.weight.forEach(x => { if (!wd.has(x.date)) D.weight.push(x); });
      const pids = new Set(D.programs.map(x => x.id)); r.programs.forEach(x => { if (!pids.has(x.id)) D.programs.push(x); });
      D.programs.sort((x, y) => x.start < y.start ? -1 : 1);
      if (r.created < D.created) D.created = r.created;
      if (r.settings.lastBackup && (!D.settings.lastBackup || r.settings.lastBackup > D.settings.lastBackup)) D.settings.lastBackup = r.settings.lastBackup;
    }
    save(); UI.restoreData = null; UI.modal = null; toast('복원했어요');
  },
  delPart: a => {
    const label = { bp: '혈압 기록', med: '복용 기록과 약 변경 이력', ex: '운동 기록', weight: '체중 기록' }[a];
    openModal({ type: 'confirm', title: label + '을 모두 지울까요?', body: '지운 기록은 되돌릴 수 없어요. 필요하면 먼저 백업하세요.', onYes: () => { if (a === 'bp') D.bp = []; if (a === 'med') { D.medLog = {}; D.medChanges = []; } if (a === 'ex') D.exLog = {}; if (a === 'weight') D.weight = []; save(); UI.toast = '지웠어요'; setTimeout(() => { UI.toast = null; render(); }, 2000); } });
  },
  delAllAsk: () => openModal({ type: 'delAll' }),
  delAll: a => {
    if (a === 'backup') doBackup();
    try { localStorage.removeItem(KEY); } catch (e) {}
    D = defaultData(); UI.modal = null; UI.bp = newBpDraft(); UI.progEdit = null;
    location.hash = '#today'; toast('모든 데이터를 지웠어요');
  }
};
const CHANGE = {
  peMetric: el => { const p = el.dataset.arg.split('|'); const it = UI.progEdit.days[p[0]][Number(p[1])]; it.metric = el.value; render(); },
  peDist: el => { const p = el.dataset.arg.split('|'); UI.progEdit.days[p[0]][Number(p[1])].dist = el.checked; },
  alarmTime: el => { if (el.value) { D.settings.alarms[el.dataset.arg].time = el.value; save(); render(); } },
  nightStart: el => { if (el.value) { D.settings.nightStart = el.value; save(); render(); } },
  nightEnd: el => { if (el.value) { D.settings.nightEnd = el.value; save(); render(); } },
  goal: el => { D.settings.bpGoal[el.dataset.arg] = num(el.value); save(); },
  medField: el => { const k = el.dataset.arg; D.settings.med[k] = k === 'warnDays' ? (num(el.value) || 0) : el.value; save(); toast('저장했어요'); },
  restoreFile: el => {
    const file = el.files && el.files[0]; if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const obj = JSON.parse(rd.result); const data = obj && obj.data ? obj.data : obj;
        if (!data || !data.settings) throw new Error('bad');
        UI.restoreData = migrate(data); openModal({ type: 'restore', fileName: file.name });
      } catch (e) { toast('이 파일은 백업 파일이 아니에요'); }
      el.value = '';
    };
    rd.readAsText(file);
  }
};
function setBind(path, v) {
  const p = path.split('.');
  if (p[0] === 'bp') {
    if (p[1] === 'ts' || p[1] === 'memo') UI.bp[p[1]] = v;
    else { const m = p[1].match(/^r(\d)([sdp])$/); if (m) UI.bp.r[Number(m[1])][m[2]] = v; }
    const box = document.getElementById('bp-avg'); if (box) box.innerHTML = avgText();
  } else if (p[0] === 'f') UI.form[p[1]] = v;
  else if (p[0] === 'pe') UI.progEdit.days[p[1]][Number(p[2])][p[3]] = v;
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  if (el.dataset.act !== 'backdrop') e.preventDefault();
  fn(el.dataset.arg, el, e);
});
document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.bind) setBind(el.dataset.bind, el.value); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.change && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && UI.modal) closeModal(); });
window.addEventListener('hashchange', () => { UI.modal = null; render(); window.scrollTo(0, 0); });
window.addEventListener('storage', e => { if (e.key === KEY) { D = load(); render(); } });
setInterval(() => { if (todayStr() + activeTheme() !== lastRenderKey && !UI.modal && !UI.progEdit) render(); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && todayStr() + activeTheme() !== lastRenderKey) render(); });

if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(v => { UI.persisted = v; if (route() === 'data') render(); }).catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
render();
