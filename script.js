/**
 * 每筆紀錄：{ id, date: 'YYYY-MM-DD', type: 'run'|'walk'|'climb'|'gym', ... }
 * run/climb/walk：distance (km), hours, minutes；walk 另有 steps；climb 另有 up (m)
 * gym：part, action, weight, sets, reps, seconds (選填)
 */

let records = [];
try {
  records = JSON.parse(localStorage.getItem('workout_records')) || [];
} catch {
  records = [];
}

let gymActions = [];
try {
  gymActions = JSON.parse(localStorage.getItem('gym_actions')) || [
    { part: '胸', action: '臥推' },
    { part: '腿', action: '深蹲' }
  ];
} catch {
  gymActions = [
    { part: '胸', action: '臥推' },
    { part: '腿', action: '深蹲' }
  ];
}

/** 月曆檢視年月 */
let viewDate = new Date();

let chartStepsInst = null;
let chartDistInst = null;
let chartClimbInst = null;
let chartGymInst = null;

/** 新增表單目前選擇的 type（供儲存用） */
let currentFormType = 'run';

document.addEventListener('DOMContentLoaded', () => {
  initStatDateDefaults();
  initNavigation();
  initCalendarNav();
  renderCalendar();
  initForm();
  initTheme();
  initOcrUpload();
  initWorkoutFormSubmit();
  renderGymManageList();
  initBackupImport();
});

function initStatDateDefaults() {
  const ss = document.getElementById('stat-start');
  const se = document.getElementById('stat-end');
  const today = new Date();
  if (se && !se.value) se.value = toYMD(today);
  if (ss && !ss.value) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    ss.value = toYMD(start);
  }
}

function persistRecords() {
  localStorage.setItem('workout_records', JSON.stringify(records));
}

function persistGymActions() {
  localStorage.setItem('gym_actions', JSON.stringify(gymActions));
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// --- 導航 ---
function initNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.onclick = () => {
      const target = btn.dataset.target;
      document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
      document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
      document.getElementById(target).classList.add('active');
      btn.classList.add('active');
      if (target === 'stats-view') updateCharts();
    };
  });
}

function initCalendarNav() {
  const prev = document.getElementById('prev-month');
  const next = document.getElementById('next-month');
  if (prev) {
    prev.onclick = () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      renderCalendar();
    };
  }
  if (next) {
    next.onclick = () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      renderCalendar();
    };
  }
}

function dayIntensityScore(dayRecords) {
  let s = 0;
  dayRecords.forEach((r) => {
    if (r.type === 'walk') s += Number(r.steps || 0) / 4000;
    if (r.type === 'run') s += Number(r.distance || 0) / 3 + (Number(r.hours || 0) * 60 + Number(r.minutes || 0)) / 90;
    if (r.type === 'climb') s += Number(r.distance || 0) / 4 + Number(r.up || 0) / 600;
    if (r.type === 'gym') s += (Number(r.weight || 0) * Number(r.sets || 0) * Number(r.reps || 0)) / 6000;
  });
  return Math.min(s, 1);
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const header = document.getElementById('current-month-year');
  if (header) header.innerText = `${y}年 ${m + 1}月`;

  const first = new Date(y, m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  for (let pad = 0; pad < startPad; pad++) {
    const ghost = document.createElement('div');
    ghost.className = 'calendar-day ghost';
    ghost.style.visibility = 'hidden';
    grid.appendChild(ghost);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    dayDiv.innerText = String(i);

    const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayRecords = records.filter((r) => r.date === ymd);

    if (dayRecords.length > 0) {
      const score = dayIntensityScore(dayRecords);
      dayDiv.style.backgroundColor = `rgba(77, 171, 247, ${0.12 + score * 0.55})`;

      const dots = document.createElement('div');
      dots.className = 'day-dots';
      const types = [...new Set(dayRecords.map((r) => r.type))];
      types.forEach((t) => {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.style.background = `var(--${t}-color)`;
        dots.appendChild(dot);
      });
      dayDiv.appendChild(dots);

      const badge = document.createElement('div');
      badge.className = 'count-badge';
      badge.innerText = dayRecords.length;
      dayDiv.appendChild(badge);
    }
    dayDiv.onclick = () => showDayDetail(i);
    grid.appendChild(dayDiv);
  }
}

function closeDetail() {
  document.getElementById('day-detail-panel').classList.add('hidden');
}

function showDayDetail(dayOfMonth) {
  const panel = document.getElementById('day-detail-panel');
  const list = document.getElementById('detail-list');
  if (!panel || !list) return;

  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const ymd = `${y}-${String(m + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
  const dayRecords = records.filter((r) => r.date === ymd).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  list.innerHTML = '';
  if (dayRecords.length === 0) {
    list.innerHTML = '<p>當日尚無紀錄</p>';
  } else {
    dayRecords.forEach((r) => {
      const card = document.createElement('div');
      card.className = `detail-card card-${r.type}`;
      const title = document.createElement('div');
      title.innerHTML = `<strong>${typeLabel(r.type)}</strong> ${escapeHtml(summaryLine(r))}`;
      const actions = document.createElement('div');
      actions.className = 'detail-actions';
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-small';
      editBtn.textContent = '編輯';
      editBtn.onclick = () => editRecord(r.id);
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-small danger';
      delBtn.textContent = '刪除';
      delBtn.onclick = () => deleteRecord(r.id);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      card.appendChild(title);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }
  panel.classList.remove('hidden');
}

function typeLabel(t) {
  return { run: '跑步', walk: '散步', climb: '登山', gym: '重訓' }[t] || t;
}

function summaryLine(r) {
  if (r.type === 'gym') return `${r.part || ''} ${r.action || ''} ${r.weight || 0}kg ×${r.sets || 0}×${r.reps || 0}`;
  const parts = [];
  if (r.distance != null) parts.push(`${r.distance} km`);
  if (r.hours || r.minutes) parts.push(`${r.hours || 0}時${r.minutes || 0}分`);
  if (r.type === 'walk' && r.steps != null) parts.push(`${r.steps} 步`);
  if (r.type === 'climb' && r.up != null) parts.push(`上升 ${r.up}m`);
  return parts.join(' · ') || '—';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function deleteRecord(id) {
  if (!confirm('確定刪除此筆紀錄？')) return;
  records = records.filter((r) => r.id !== id);
  persistRecords();
  renderCalendar();
  closeDetail();
}

function editRecord(id) {
  const r = records.find((x) => x.id === id);
  if (!r) return;

  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach((s) => s.classList.remove('active'));
  document.getElementById('add-view').classList.add('active');
  document.querySelector('.nav-item[data-target="add-view"]')?.classList.add('active');

  currentFormType = r.type;
  const form = document.getElementById('workout-form');
  form.className = `active-form-${r.type}`;
  form.classList.remove('hidden');
  renderFields(r.type);

  const dateEl = document.getElementById('f-date');
  if (dateEl) dateEl.value = r.date;

  if (r.type === 'gym') {
    const partEl = document.getElementById('f-gym-part');
    const actEl = document.getElementById('f-gym-action');
    if (partEl) partEl.value = r.part || '';
    updateActions();
    if (actEl) actEl.value = r.action || '';
    const w = document.getElementById('f-weight');
    const s = document.getElementById('f-sets');
    const rep = document.getElementById('f-reps');
    const sec = document.getElementById('f-seconds');
    if (w) w.value = r.weight ?? '';
    if (s) s.value = r.sets ?? '';
    if (rep) rep.value = r.reps ?? '';
    if (sec) sec.value = r.seconds ?? '';
  } else {
    const dist = document.getElementById('f-dist');
    const hr = document.getElementById('f-hr');
    const mn = document.getElementById('f-min');
    if (dist) dist.value = r.distance ?? '';
    if (hr) hr.value = r.hours ?? '';
    if (mn) mn.value = r.minutes ?? '';
    if (r.type === 'walk') {
      const st = document.getElementById('f-steps');
      if (st) st.value = r.steps ?? '';
    }
    if (r.type === 'climb') {
      const up = document.getElementById('f-up');
      if (up) up.value = r.up ?? '';
    }
  }

  form.dataset.editId = id;
  closeDetail();
}

// --- 新增表單 ---
function initForm() {
  const typeBtns = document.querySelectorAll('.type-btn');
  const form = document.getElementById('workout-form');

  typeBtns.forEach((btn) => {
    btn.onclick = () => {
      delete form.dataset.editId;
      const type = btn.dataset.type;
      currentFormType = type;
      form.className = `active-form-${type}`;
      form.classList.remove('hidden');
      renderFields(type);
    };
  });
}

function renderFields(type) {
  const container = document.getElementById('form-fields');
  const today = toYMD(new Date());
  let html = `<input type="date" id="f-date" value="${today}">`;

  if (type === 'gym') {
    const parts = [...new Set(gymActions.map((a) => a.part))];
    html += `
      <select id="f-gym-part" onchange="updateActions()">${parts.map((p) => `<option value="${escapeAttr(p)}">${escapeHtml(p)}</option>`).join('')}</select>
      <select id="f-gym-action" onchange="loadLastGymData()"></select>
      <input type="number" id="f-weight" placeholder="重量 (kg)" step="0.5" min="0">
      <input type="number" id="f-sets" placeholder="組數" min="0" step="1">
      <input type="number" id="f-reps" placeholder="次數" min="0" step="1">
      <input type="number" id="f-seconds" placeholder="秒數 (選填)" min="0" step="1">
      <button type="button" onclick="openTimer()">⏱️ 開啟馬錶</button>
    `;
  } else {
    html += `
      <input type="number" step="0.01" min="0" id="f-dist" placeholder="距離 (km)">
      <div class="time-group">
        <input type="number" id="f-hr" placeholder="時" min="0" step="1">
        <input type="number" id="f-min" placeholder="分" min="0" max="59" step="1">
      </div>
    `;
    if (type === 'walk') html += `<input type="number" id="f-steps" placeholder="步數" min="0" step="1">`;
    if (type === 'climb') html += `<input type="number" id="f-up" placeholder="上升公尺" min="0" step="1">`;
  }
  container.innerHTML = html;
  if (type === 'gym') {
    updateActions();
    loadLastGymData();
  }
}

function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}

function updateActions() {
  const partEl = document.getElementById('f-gym-part');
  const actEl = document.getElementById('f-gym-action');
  if (!partEl || !actEl) return;
  const part = partEl.value;
  const actions = gymActions.filter((a) => a.part === part).map((a) => a.action);
  const uniq = [...new Set(actions)];
  actEl.innerHTML = uniq.map((a) => `<option value="${escapeAttr(a)}">${escapeHtml(a)}</option>`).join('');
  loadLastGymData();
}

/**
 * 重訓記憶：依「部位 + 動作」找 records 中最後一筆 gym，填入重量、組數、次數
 */
function loadLastGymData() {
  const partEl = document.getElementById('f-gym-part');
  const actEl = document.getElementById('f-gym-action');
  const wEl = document.getElementById('f-weight');
  const sEl = document.getElementById('f-sets');
  const rEl = document.getElementById('f-reps');
  if (!partEl || !actEl || !wEl || !sEl || !rEl) return;

  const part = partEl.value.trim();
  const action = actEl.value.trim();
  if (!part || !action) return;

  const candidates = records
    .filter((r) => r.type === 'gym' && String(r.part || '').trim() === part && String(r.action || '').trim() === action)
    .sort((a, b) => {
      const ta = new Date(a.date + 'T12:00:00').getTime();
      const tb = new Date(b.date + 'T12:00:00').getTime();
      if (tb !== ta) return tb - ta;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

  const last = candidates[0];
  if (!last) return;

  if (last.weight != null) wEl.value = last.weight;
  if (last.sets != null) sEl.value = last.sets;
  if (last.reps != null) rEl.value = last.reps;
  const secEl = document.getElementById('f-seconds');
  if (secEl && last.seconds != null) secEl.value = last.seconds;
}

function initWorkoutFormSubmit() {
  const form = document.getElementById('workout-form');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const date = document.getElementById('f-date')?.value;
    if (!date) return alert('請選擇日期');

    const editId = form.dataset.editId;
    const base = {
      id: editId || crypto.randomUUID(),
      date,
      type: currentFormType,
      createdAt: Date.now()
    };

    let rec = { ...base };
    if (currentFormType === 'gym') {
      rec.part = document.getElementById('f-gym-part')?.value?.trim() || '';
      rec.action = document.getElementById('f-gym-action')?.value?.trim() || '';
      rec.weight = numOrNull(document.getElementById('f-weight')?.value);
      rec.sets = numOrNull(document.getElementById('f-sets')?.value);
      rec.reps = numOrNull(document.getElementById('f-reps')?.value);
      rec.seconds = numOrNull(document.getElementById('f-seconds')?.value);
    } else {
      rec.distance = numOrNull(document.getElementById('f-dist')?.value, 2);
      rec.hours = numOrNull(document.getElementById('f-hr')?.value);
      rec.minutes = numOrNull(document.getElementById('f-min')?.value);
      if (currentFormType === 'walk') rec.steps = numOrNull(document.getElementById('f-steps')?.value);
      if (currentFormType === 'climb') rec.up = numOrNull(document.getElementById('f-up')?.value);
    }

    if (editId) {
      records = records.filter((r) => r.id !== editId);
      delete form.dataset.editId;
    }
    records.push(rec);
    persistRecords();
    form.reset();
    form.classList.add('hidden');
    renderCalendar();
    updateCharts();
    alert('已儲存');
  });
}

function numOrNull(v, fixed = null) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return fixed == null ? n : Number(n.toFixed(fixed));
}

// --- OCR：辨識後填入距離/步數，清空 input，不存圖 ---
function initOcrUpload() {
  const input = document.getElementById('ocr-upload');
  const status = document.getElementById('ocr-status');
  if (!input) return;

  input.addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (typeof Tesseract === 'undefined' || !Tesseract.recognize) {
      if (status) status.textContent = 'Tesseract 未載入，請檢查網路或 CDN。';
      input.value = '';
      return;
    }
    if (status) status.textContent = '辨識中…';

    try {
      const { data } = await Tesseract.recognize(file, 'eng', { logger: () => {} });
      const text = data?.text || '';
      applyOcrNumbers(text);
      if (status) status.textContent = '辨識完成，已填入數字（請自行確認）。';
    } catch (err) {
      if (status) status.textContent = `辨識失敗：${err.message || err}`;
    } finally {
      input.value = '';
    }
  });
}

function applyOcrNumbers(text) {
  const normalized = text.replace(/,/g, ' ');
  const decimals = [...normalized.matchAll(/\d+\.\d+/g)].map((m) => m[0]);
  const ints = [...normalized.matchAll(/\b\d{3,}\b/g)].map((m) => m[0]);

  const distEl = document.getElementById('f-dist');
  const stepsEl = document.getElementById('f-steps');

  if (distEl && decimals.length) {
    distEl.value = decimals[0];
  }
  if (stepsEl && ints.length) {
    const big = ints.map(Number).sort((a, b) => b - a)[0];
    if (big >= 100) stepsEl.value = String(big);
  }
  if (distEl && !distEl.value) {
    const km = normalized.match(/(\d+(?:\.\d+)?)\s*km/i);
    if (km) distEl.value = km[1];
  }
  if (stepsEl && !stepsEl.value) {
    const st = normalized.match(/steps?\s*[:\s]?\s*(\d{3,})/i);
    if (st) stepsEl.value = st[1];
  }
}

// --- 馬錶 ---
let timer;
function openTimer() {
  document.getElementById('timer-modal')?.classList.remove('hidden');
}
function closeTimer() {
  clearInterval(timer);
  document.getElementById('timer-modal')?.classList.add('hidden');
}
function startTimer(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return;
  clearInterval(timer);
  let r = Math.floor(n);
  const display = document.getElementById('timer-display');
  if (display) display.innerText = `${Math.floor(r / 60)}:${(r % 60).toString().padStart(2, '0')}`;
  timer = setInterval(() => {
    r--;
    if (display) display.innerText = `${Math.floor(r / 60)}:${(r % 60).toString().padStart(2, '0')}`;
    if (r <= 0) {
      clearInterval(timer);
      document.querySelector('.modal-content')?.classList.add('timer-blink');
      setTimeout(() => document.querySelector('.modal-content')?.classList.remove('timer-blink'), 5000);
      alert('時間到！休息結束 💪');
    }
  }, 1000);
}

// --- 統計：依 stat-start / stat-end 篩選，四張長條圖 ---
function destroyChart(inst) {
  if (inst && typeof inst.destroy === 'function') inst.destroy();
  return null;
}

function filterRecordsByStatRange() {
  const startStr = document.getElementById('stat-start')?.value;
  const endStr = document.getElementById('stat-end')?.value;
  const start = startStr ? parseYMD(startStr) : null;
  const end = endStr ? parseYMD(endStr) : null;
  if (!start && !end) return [...records];
  return records.filter((r) => {
    const d = parseYMD(r.date);
    if (!d) return false;
    if (start && d < new Date(start.getFullYear(), start.getMonth(), start.getDate())) return false;
    if (end && d > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999)) return false;
    return true;
  });
}

function bucketKeyForRecord(dateStr, period) {
  const d = parseYMD(dateStr);
  if (!d) return 'unknown';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  if (period === 'day') return dateStr;
  if (period === 'month') return `${y}-${String(m).padStart(2, '0')}`;
  if (period === 'year') return `${y}`;
  if (period === 'quarter') return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return dateStr;
}

function aggregateForCharts(filtered) {
  const period = document.getElementById('stat-period')?.value || 'day';
  const buckets = {};

  filtered.forEach((r) => {
    const key = bucketKeyForRecord(r.date, period);
    if (!buckets[key]) buckets[key] = { steps: 0, dist: 0, up: 0, load: 0 };
    if (r.type === 'walk') buckets[key].steps += Number(r.steps || 0);
    if (r.type === 'run' || r.type === 'climb') buckets[key].dist += Number(r.distance || 0);
    if (r.type === 'climb') buckets[key].up += Number(r.up || 0);
    if (r.type === 'gym') {
      buckets[key].load += Number(r.weight || 0) * Number(r.sets || 0) * Number(r.reps || 0);
    }
  });

  const labels = Object.keys(buckets).sort();
  return {
    labels,
    steps: labels.map((k) => buckets[k].steps),
    dist: labels.map((k) => buckets[k].dist),
    up: labels.map((k) => buckets[k].up),
    load: labels.map((k) => buckets[k].load)
  };
}

function updateCharts() {
  const filtered = filterRecordsByStatRange();
  const { labels, steps, dist, up, load } = aggregateForCharts(filtered);

  chartStepsInst = destroyChart(chartStepsInst);
  chartDistInst = destroyChart(chartDistInst);
  chartClimbInst = destroyChart(chartClimbInst);
  chartGymInst = destroyChart(chartGymInst);

  const common = {
    type: 'bar',
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  };

  const ctxS = document.getElementById('stepsChart')?.getContext('2d');
  if (ctxS) {
    chartStepsInst = new Chart(ctxS, {
      ...common,
      data: {
        labels: labels.length ? labels : ['無資料'],
        datasets: [{ label: '步數 (walk)', data: labels.length ? steps : [0], backgroundColor: '#FFD740' }]
      }
    });
  }

  const ctxD = document.getElementById('distChart')?.getContext('2d');
  if (ctxD) {
    chartDistInst = new Chart(ctxD, {
      ...common,
      data: {
        labels: labels.length ? labels : ['無資料'],
        datasets: [{ label: '距離 km (run + climb)', data: labels.length ? dist : [0], backgroundColor: '#FF5252' }]
      }
    });
  }

  const ctxC = document.getElementById('climbChart')?.getContext('2d');
  if (ctxC) {
    chartClimbInst = new Chart(ctxC, {
      ...common,
      data: {
        labels: labels.length ? labels : ['無資料'],
        datasets: [{ label: '上升 m (climb)', data: labels.length ? up : [0], backgroundColor: '#448AFF' }]
      }
    });
  }

  const ctxG = document.getElementById('gymChart')?.getContext('2d');
  if (ctxG) {
    chartGymInst = new Chart(ctxG, {
      ...common,
      data: {
        labels: labels.length ? labels : ['無資料'],
        datasets: [{ label: '總負荷 (gym)', data: labels.length ? load : [0], backgroundColor: '#B388FF' }]
      }
    });
  }
}

// --- 主題 ---
function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') document.body.classList.add('dark-mode');
  btn?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
  });
}

// --- 管理重訓項目 ---
function addGymAction() {
  const part = document.getElementById('new-part')?.value?.trim();
  const action = document.getElementById('new-action')?.value?.trim();
  if (!part || !action) return alert('請輸入部位與動作');
  gymActions.push({ part, action });
  persistGymActions();
  document.getElementById('new-part').value = '';
  document.getElementById('new-action').value = '';
  renderGymManageList();
}

function renderGymManageList() {
  const ul = document.getElementById('gym-action-list');
  if (!ul) return;
  ul.innerHTML = '';
  gymActions.forEach((item, idx) => {
    const li = document.createElement('li');
    li.textContent = `${item.part} — ${item.action}`;
    const del = document.createElement('button');
    del.textContent = '刪除';
    del.onclick = () => {
      gymActions.splice(idx, 1);
      persistGymActions();
      renderGymManageList();
    };
    li.appendChild(del);
    ul.appendChild(li);
  });
}

// --- 備份 ---
function exportData() {
  const blob = new Blob([JSON.stringify({ records, gymActions }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `workout-backup-${toYMD(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function initBackupImport() {
  const inp = document.getElementById('import-file');
  if (!inp) return;
  inp.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const data = JSON.parse(text);
      if (data.records) records = data.records;
      if (data.gymActions) gymActions = data.gymActions;
      persistRecords();
      persistGymActions();
      renderCalendar();
      renderGymManageList();
      updateCharts();
      alert('匯入成功');
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
    inp.value = '';
  });
}
