/**
 * 每筆紀錄：{ id, date: 'YYYY-MM-DD', type: 'run'|'walk'|'climb'|'gym', ... }
 * run/climb/walk：distance (km), hours, minutes；walk 另有 steps；climb 另有 ascent (m)
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
      openOverlay(target, btn);
    };
  });
}

function openOverlay(id, btn = null) {
  // 單一視窗原則：關閉所有已開啟的視窗
  document.querySelectorAll('.view-section.overlay').forEach(s => s.classList.remove('active'));
  document.getElementById('day-detail-panel')?.classList.add('hidden');
  
  const overlay = document.getElementById(id);
  if (!overlay) return;
  
  // 重置背景色
  document.body.style.backgroundColor = '';

  // 如果是新增，重置顯示狀態
  if (id === 'add-view') {
    const selector = document.getElementById('add-type-selector');
    const form = document.getElementById('workout-form');
    selector.classList.remove('hidden');
    form.classList.add('hidden');
    delete form.dataset.editId;
  }
  
  overlay.classList.add('active');
  if (btn) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    btn.classList.add('active'); // 標記點選的按鈕
  }
  
  // 統計中心：使用 requestAnimationFrame 確保 DOM 渲染完成
  if (id === 'stats-view') {
    requestAnimationFrame(() => {
      setTimeout(() => {
        updateCharts();
      }, 50);
    });
  }
}

function closeOverlay(id, event = null) {
  if (event) event.stopPropagation(); // 防止事件冒泡觸發月曆點擊
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('active');
  
  // 重置背景色
  document.body.style.backgroundColor = '';

  // 關閉 Overlay 時，清空導航列的 active 狀態（回到月曆）
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
}

function initCalendarNav() {
  const prev = document.getElementById('prev-month');
  const next = document.getElementById('next-month');
  if (prev) {
    prev.onclick = (e) => {
      e.stopPropagation();
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      renderCalendar();
    };
  }
  if (next) {
    next.onclick = (e) => {
      e.stopPropagation();
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
    if (r.type === 'climb') s += Number(r.distance || 0) / 4 + Number(r.ascent || 0) / 600;
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
    
    // 日期數字
    const dateNum = document.createElement('span');
    dateNum.innerText = String(i);
    dayDiv.appendChild(dateNum);

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

function closeDetail(event = null) {
  if (event) event.stopPropagation(); // 防止事件冒泡
  document.getElementById('day-detail-panel').classList.add('hidden');
}

function showDayDetail(dayOfMonth) {
  // 單一視窗原則
  document.querySelectorAll('.view-section.overlay').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

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
  if (r.title) parts.push(`[${r.title}]`);
  if (r.distance != null) parts.push(`${r.distance} km`);
  if (r.type === 'run' && r.avgPace) parts.push(`配速 ${r.avgPace}`);
  if (r.hours || r.minutes) parts.push(`${r.hours || 0}時${r.minutes || 0}分`);
  if (r.type === 'walk' && r.steps != null) parts.push(`${r.steps} 步`);
  if (r.ascent != null) parts.push(`爬升 ${r.ascent}m`);
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

  openOverlay('add-view');
  
  const selector = document.getElementById('add-type-selector');
  selector.classList.add('hidden'); // 編輯時隱藏大按鈕

  currentFormType = r.type;
  const form = document.getElementById('workout-form');
  form.className = `active-form-${r.type}`;
  form.classList.remove('hidden');
  renderFields(r.type);
  
  // 背景連動
  const colors = { run: '#FFEBEE', walk: '#FFFDE7', climb: '#E3F2FD', gym: '#F3E5F5' };
  document.body.style.backgroundColor = colors[r.type] || '';

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
    const titleEl = document.getElementById('f-title');
    if (titleEl) titleEl.value = r.title || '';
    
    const dist = document.getElementById('f-dist');
    const hr = document.getElementById('f-hr');
    const mn = document.getElementById('f-min');
    if (dist) dist.value = r.distance ?? '';
    if (hr) hr.value = r.hours ?? '';
    if (mn) mn.value = r.minutes ?? '';
    
    if (r.type === 'run') {
      const pace = document.getElementById('f-avg-pace');
      const speed = document.getElementById('f-avg-speed');
      const maxS = document.getElementById('f-max-speed');
      const asc = document.getElementById('f-ascent');
      const des = document.getElementById('f-descent');
      const alt = document.getElementById('f-max-alt');
      if (pace) pace.value = r.avgPace ?? '';
      if (speed) speed.value = r.avgSpeed ?? '';
      if (maxS) maxS.value = r.maxSpeed ?? '';
      if (asc) asc.value = r.ascent ?? '';
      if (des) des.value = r.descent ?? '';
      if (alt) alt.value = r.maxAlt ?? '';
    }
    if (r.type === 'walk') {
      const st = document.getElementById('f-steps');
      if (st) st.value = r.steps ?? '';
    }
    if (r.type === 'climb') {
      const speed = document.getElementById('f-avg-speed');
      const elev = document.getElementById('f-elev-gain');
      const asc = document.getElementById('f-ascent');
      const des = document.getElementById('f-descent');
      if (speed) speed.value = r.avgSpeed ?? '';
      if (elev) elev.value = r.elevGain ?? '';
      if (asc) asc.value = r.ascent ?? '';
      if (des) des.value = r.descent ?? '';
    }
  }

  form.dataset.editId = id;
}

// --- 新增表單 ---
function initForm() {
  const typeBtns = document.querySelectorAll('.type-btn');
  const selector = document.getElementById('add-type-selector');
  const form = document.getElementById('workout-form');

  typeBtns.forEach((btn) => {
    btn.onclick = () => {
      delete form.dataset.editId;
      const type = btn.dataset.type;
      currentFormType = type;
      
      // 動態切換邏輯
      selector.classList.add('hidden');
      form.className = `active-form-${type}`;
      form.classList.remove('hidden');
      renderFields(type);
      
      // 背景連動
      const colors = { run: '#FFEBEE', walk: '#FFFDE7', climb: '#E3F2FD', gym: '#F3E5F5' };
      document.body.style.backgroundColor = colors[type] || '';
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
      <button type="button" class="timer-btn" onclick="openTimer()">⏱️ 開啟馬錶</button>
    `;
  } else {
    html += `<input type="text" id="f-title" placeholder="訓練標題 (選填)">`;
    html += `
      <input type="number" step="0.01" min="0" id="f-dist" placeholder="距離 (km)">
      <div class="time-group">
        <input type="number" id="f-hr" placeholder="時" min="0" step="1">
        <input type="number" id="f-min" placeholder="分" min="0" max="59" step="1">
      </div>
    `;
    if (type === 'run') {
      html += `
        <input type="text" id="f-avg-pace" placeholder="平均配速 (如 07:17)" oninput="formatPace(this)">
        <input type="number" step="0.1" id="f-avg-speed" placeholder="平均速度 (km/h)">
        <input type="number" step="0.1" id="f-max-speed" placeholder="最快速度 (km/h)">
        <input type="number" id="f-ascent" placeholder="累計爬升 (m)">
        <input type="number" id="f-descent" placeholder="累計下降 (m)">
        <input type="number" id="f-max-alt" placeholder="最高海拔 (m)">
      `;
    }
    if (type === 'walk') {
      html += `<input type="number" id="f-steps" placeholder="步數" min="0" step="1">`;
    }
    if (type === 'climb') {
      html += `
        <input type="number" step="0.1" id="f-avg-speed" placeholder="平均速度 (km/h)">
        <input type="number" id="f-elev-gain" placeholder="高度落差 (m)">
        <input type="number" id="f-ascent" placeholder="累計爬升 (m)">
        <input type="number" id="f-descent" placeholder="累計下降 (m)">
      `;
    }
  }
  container.innerHTML = html;
  if (type === 'gym') {
    updateActions();
    loadLastGymData();
  }
}

function formatPace(input) {
  let v = input.value.replace(/[^\d]/g, '');
  if (v.length > 4) v = v.slice(0, 4);
  if (v.length >= 3) {
    input.value = v.slice(0, v.length - 2) + ':' + v.slice(v.length - 2);
  } else {
    input.value = v;
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
  const secEl = document.getElementById('f-seconds');
  if (!partEl || !actEl || !wEl || !sEl || !rEl) return;

  const part = partEl.value.trim();
  const action = actEl.value.trim();
  
  // 先清空，再填入（或不填）
  wEl.value = '';
  sEl.value = '';
  rEl.value = '';
  if (secEl) secEl.value = '';

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
      rec.title = document.getElementById('f-title')?.value?.trim() || '';
      rec.distance = numOrNull(document.getElementById('f-dist')?.value, 2);
      rec.hours = numOrNull(document.getElementById('f-hr')?.value);
      rec.minutes = numOrNull(document.getElementById('f-min')?.value);
      if (currentFormType === 'run') {
        rec.avgPace = document.getElementById('f-avg-pace')?.value?.trim() || '';
        rec.avgSpeed = numOrNull(document.getElementById('f-avg-speed')?.value, 1);
        rec.maxSpeed = numOrNull(document.getElementById('f-max-speed')?.value, 1);
        rec.ascent = numOrNull(document.getElementById('f-ascent')?.value);
        rec.descent = numOrNull(document.getElementById('f-descent')?.value);
        rec.maxAlt = numOrNull(document.getElementById('f-max-alt')?.value);
      }
      if (currentFormType === 'walk') {
        rec.steps = numOrNull(document.getElementById('f-steps')?.value);
      }
      if (currentFormType === 'climb') {
        rec.avgSpeed = numOrNull(document.getElementById('f-avg-speed')?.value, 1);
        rec.elevGain = numOrNull(document.getElementById('f-elev-gain')?.value);
        rec.ascent = numOrNull(document.getElementById('f-ascent')?.value);
        rec.descent = numOrNull(document.getElementById('f-descent')?.value);
      }
    }

    if (editId) {
      records = records.filter((r) => r.id !== editId);
      delete form.dataset.editId;
    }
    records.push(rec);
    persistRecords();
    form.reset();
    form.classList.add('hidden');
    
    // 重置背景與顯示
    document.body.style.backgroundColor = '';
    document.getElementById('add-type-selector').classList.remove('hidden');

    closeOverlay('add-view');
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

// --- 智慧 OCR ---
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
      const { data } = await Tesseract.recognize(file, 'eng+chi_tra', { logger: () => {} });
      const text = data?.text || '';
      smartOCR(text);
      if (status) status.textContent = '智慧辨識完成，已自動填充欄位。';
    } catch (err) {
      if (status) status.textContent = `辨識失敗：${err.message || err}`;
    } finally {
      input.value = '';
    }
  });
}

function smartOCR(text) {
  const t = text.replace(/\s+/g, ' ');
  console.log("OCR Text:", t);

  // 1. 判斷模版
  let type = '';
  if (t.includes('Average Pace') || t.includes('Calories')) type = 'run';
  else if (t.includes('總爬升') || t.includes('Hikingbook')) type = 'climb';
  else if (t.includes('活躍時間') || t.includes('步數目標') || t.includes('Pacer')) type = 'walk';

  if (!type) {
    applyOcrNumbers(text); // 退回到通用數字抓取
    return;
  }

  // 自動切換到對應類型
  const selector = document.getElementById('add-type-selector');
  const form = document.getElementById('workout-form');
  currentFormType = type;
  selector.classList.add('hidden');
  form.className = `active-form-${type}`;
  form.classList.remove('hidden');
  renderFields(type);
  const colors = { run: '#FFEBEE', walk: '#FFFDE7', climb: '#E3F2FD', gym: '#F3E5F5' };
  document.body.style.backgroundColor = colors[type] || '';

  // 2. 提取邏輯
  if (type === 'run') {
    // 距離: 2位整數.2位小數
    const distMatch = t.match(/(\d{1,2}\.\d{2})/);
    if (distMatch) document.getElementById('f-dist').value = distMatch[1];
    
    // 配速: 07:17
    const paceMatch = t.match(/(\d{2}:\d{2})/);
    if (paceMatch) document.getElementById('f-avg-pace').value = paceMatch[1];
    
    // 時間: 00:34:34
    const timeMatch = t.match(/(\d{2}:\d{2}:\d{2})/);
    if (timeMatch) {
      const [h, m, s] = timeMatch[1].split(':').map(Number);
      document.getElementById('f-hr').value = h;
      document.getElementById('f-min').value = m;
    }
  } 
  else if (type === 'climb') {
    // 距離
    const distMatch = t.match(/(\d+\.\d+)\s*km/i) || t.match(/(\d+\.\d+)/);
    if (distMatch) document.getElementById('f-dist').value = distMatch[1];

    // 爬升/下降
    const ascMatch = t.match(/總爬升\s*(\d+)/) || t.match(/(\d+)\s*m/);
    if (ascMatch) document.getElementById('f-ascent').value = ascMatch[1];
    const desMatch = t.match(/總下降\s*(\d+)/);
    if (desMatch) document.getElementById('f-descent').value = desMatch[1];

    // 高度落差計算
    const altMatch = t.matchAll(/(\d{3,4})\s*m/g);
    const alts = [...altMatch].map(m => Number(m[1]));
    if (alts.length >= 2) {
      const maxAlt = Math.max(...alts);
      const minAlt = Math.min(...alts);
      document.getElementById('f-elev-gain').value = maxAlt - minAlt;
    }
  }
  else if (type === 'walk') {
    // 步數: 5位數
    const stepsMatch = t.match(/(\d{4,6})/);
    if (stepsMatch) document.getElementById('f-steps').value = stepsMatch[1];
    
    // 距離
    const distMatch = t.match(/(\d+\.\d+)/);
    if (distMatch) document.getElementById('f-dist').value = distMatch[1];
  }
}

function clearFormInputs() {
  const inputs = document.querySelectorAll('#workout-form input[type="number"], #workout-form input[type="text"]');
  inputs.forEach(input => {
    if (input.id !== 'f-date') input.value = '';
  });
}

function applyOcrNumbers(text) {
  const matches = text.match(/\d+(\.\d+)?/g);
  if (!matches) return;
  const numbers = matches.map(m => m);
  const distEl = document.getElementById('f-dist');
  const otherInputs = Array.from(document.querySelectorAll('#workout-form input[type="number"]'))
    .filter(i => i.id !== 'f-dist' && i.id !== 'f-date');
  let numIdx = 0;
  if (distEl && numbers[numIdx]) {
    distEl.value = numbers[numIdx];
    numIdx++;
  }
  otherInputs.forEach((input) => {
    if (numbers[numIdx] != null) {
      input.value = numbers[numIdx];
      numIdx++;
    }
  });
}

// --- 馬錶 ---
let timer;
function openTimer() {
  const modal = document.getElementById('timer-modal');
  modal?.classList.add('active');
  modal?.classList.remove('timer-blink'); // 確保開啟時沒有閃爍
}
function closeTimer() {
  clearInterval(timer);
  const modal = document.getElementById('timer-modal');
  modal?.classList.remove('active');
  modal?.classList.remove('timer-blink');
}
function startTimer(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return;
  clearInterval(timer);
  let r = Math.floor(n);
  const display = document.getElementById('timer-display');
  const modal = document.getElementById('timer-modal');
  
  if (display) display.innerText = `${Math.floor(r / 60)}:${(r % 60).toString().padStart(2, '0')}`;
  modal?.classList.remove('timer-blink'); // 重置
  
  timer = setInterval(() => {
    r--;
    if (display) display.innerText = `${Math.floor(r / 60)}:${(r % 60).toString().padStart(2, '0')}`;
    if (r <= 0) {
      clearInterval(timer);
      modal?.classList.add('timer-blink'); // 啟動呼吸燈效果
      
      // 視覺回饋：震動 (如果支援)
      if (window.navigator.vibrate) window.navigator.vibrate([300, 100, 300, 100, 300]);
    }
  }, 1000);
}

// --- 統計 ---
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
    if (r.type === 'climb') buckets[key].up += Number(r.ascent || 0);
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
  const startStr = document.getElementById('stat-start')?.value;
  const endStr = document.getElementById('stat-end')?.value;
  if (startStr && endStr && startStr > endStr) {
    alert('起始日期不能大於結束日期');
    return;
  }
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
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  };

  const ctxS = document.getElementById('stepsChart')?.getContext('2d');
  if (ctxS) chartStepsInst = new Chart(ctxS, { ...common, data: { labels: labels.length ? labels : ['無資料'], datasets: [{ label: '步數 (walk)', data: labels.length ? steps : [0], backgroundColor: '#FFD740' }] } });
  
  const ctxD = document.getElementById('distChart')?.getContext('2d');
  if (ctxD) chartDistInst = new Chart(ctxD, { ...common, data: { labels: labels.length ? labels : ['無資料'], datasets: [{ label: '距離 km (run + climb)', data: labels.length ? dist : [0], backgroundColor: '#FF5252' }] } });
  
  const ctxC = document.getElementById('climbChart')?.getContext('2d');
  if (ctxC) chartClimbInst = new Chart(ctxC, { ...common, data: { labels: labels.length ? labels : ['無資料'], datasets: [{ label: '上升 m (climb)', data: labels.length ? up : [0], backgroundColor: '#448AFF' }] } });
  
  const ctxG = document.getElementById('gymChart')?.getContext('2d');
  if (ctxG) chartGymInst = new Chart(ctxG, { ...common, data: { labels: labels.length ? labels : ['無資料'], datasets: [{ label: '總負荷 (gym)', data: labels.length ? load : [0], backgroundColor: '#B388FF' }] } });

  // 確保 Resize
  if (chartStepsInst) chartStepsInst.resize();
  if (chartDistInst) chartDistInst.resize();
  if (chartClimbInst) chartClimbInst.resize();
  if (chartGymInst) chartGymInst.resize();
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
  const exists = gymActions.some(a => a.part === part && a.action === action);
  if (exists) return alert('此部位與動作已存在！');
  gymActions.push({ part, action });
  persistGymActions();
  document.getElementById('new-part').value = '';
  document.getElementById('new-action').value = '';
  renderGymManageList();
  if (currentFormType === 'gym') renderFields('gym');
}

function renderGymManageList() {
  const container = document.getElementById('gym-manage-container');
  if (!container) return;
  container.innerHTML = '';
  const groups = {};
  gymActions.forEach((item, idx) => {
    if (!groups[item.part]) groups[item.part] = [];
    groups[item.part].push({ ...item, originalIdx: idx });
  });
  Object.keys(groups).sort().forEach(part => {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'gym-group';
    groupDiv.innerHTML = `<h3>${escapeHtml(part)}</h3>`;
    groups[part].forEach(item => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'gym-action-item';
      itemDiv.innerHTML = `<span>${escapeHtml(item.action)}</span><button onclick="deleteGymAction(${item.originalIdx})">刪除</button>`;
      groupDiv.appendChild(itemDiv);
    });
    container.appendChild(groupDiv);
  });
}

function deleteGymAction(idx) {
  if (!confirm('確定刪除此動作？')) return;
  gymActions.splice(idx, 1);
  persistGymActions();
  renderGymManageList();
  if (currentFormType === 'gym') renderFields('gym');
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
