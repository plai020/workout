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
  overlay.style.backgroundColor = '';

  // 如果是新增，重置顯示狀態
  if (id === 'add-view') {
    const selector = document.getElementById('add-type-selector');
    const form = document.getElementById('workout-form');
    const title = document.getElementById('add-view-title');
    selector.classList.remove('hidden');
    selector.style.display = 'grid'; // 確保大按鈕區塊可見
    form.classList.add('hidden');
    if (title) title.innerText = '新增運動紀錄';
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
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.backgroundColor = '';
  }
  
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
  const isDark = document.body.classList.contains('dark-mode');
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
      dayDiv.style.backgroundColor = isDark
        ? `rgba(38, 84, 124, ${0.42 + score * 0.34})`
        : `rgba(77, 171, 247, ${0.12 + score * 0.55})`;
      dayDiv.style.color = isDark ? '#ffffff' : '';

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
  selector.style.display = 'none'; // 編輯時隱藏大按鈕

  currentFormType = r.type;
  const form = document.getElementById('workout-form');
  form.className = `active-form-${r.type}`;
  form.classList.remove('hidden');
  renderFields(r.type);
  
  // 標題與背景連動 (V4.1 更新)
  const title = document.getElementById('add-view-title');
  if (title) title.innerText = `${typeLabel(r.type)}紀錄編輯`;
  
  const colors = { run: '#ffebee', walk: '#fff9c4', climb: '#e3f2fd', gym: '#f3e5f5' };
  const overlay = document.getElementById('add-view');
  if (overlay) overlay.style.backgroundColor = colors[r.type] || '';
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
      
      // 動態切換邏輯 (V4.1 更新：標題、背景、隱藏選擇器)
      selector.style.display = 'none';
      form.className = `active-form-${type}`;
      form.classList.remove('hidden');
      renderFields(type);
      
      const title = document.getElementById('add-view-title');
      if (title) title.innerText = `新增${typeLabel(type)}紀錄`;
      
      const colors = { run: '#ffebee', walk: '#fff9c4', climb: '#e3f2fd', gym: '#f3e5f5' };
      const overlay = document.getElementById('add-view');
      if (overlay) overlay.style.backgroundColor = colors[type] || '';
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
      <input type="number" id="f-weight" placeholder="重量 (kg)" step="0.01" min="0">
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
        <input type="number" step="0.01" id="f-avg-speed" placeholder="平均速度 (km/h)">
        <input type="number" step="0.01" id="f-max-speed" placeholder="最快速度 (km/h)">
        <input type="number" step="0.01" id="f-ascent" placeholder="累計爬升 (m)">
        <input type="number" step="0.01" id="f-descent" placeholder="累計下降 (m)">
        <input type="number" step="0.01" id="f-max-alt" placeholder="最高海拔 (m)">
      `;
    }
    if (type === 'walk') {
      html += `<input type="number" id="f-steps" placeholder="步數" min="0" step="1">`;
    }
    if (type === 'climb') {
      html += `
        <input type="number" step="0.01" id="f-avg-speed" placeholder="平均速度 (km/h)">
        <input type="number" step="0.01" id="f-elev-gain" placeholder="高度落差 (m)">
        <input type="number" step="0.01" id="f-ascent" placeholder="累計爬升 (m)">
        <input type="number" step="0.01" id="f-descent" placeholder="累計下降 (m)">
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
    const overlay = document.getElementById('add-view');
    if (overlay) overlay.style.backgroundColor = '';
    
    const title = document.getElementById('add-view-title');
    if (title) title.innerText = '新增運動紀錄';

    const selector = document.getElementById('add-type-selector');
    selector.classList.remove('hidden');
    selector.style.display = 'grid';

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

/**
 * V4.4: 圖片預處理 (灰階 + 二值化)
 * 提升 Tesseract 辨識速度與準確率
 */
async function preprocessImage(imgElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const maxWidth = 1800;
  const scale = imgElement.naturalWidth > maxWidth ? maxWidth / imgElement.naturalWidth : 1;
  canvas.width = Math.max(1, Math.round(imgElement.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(imgElement.naturalHeight * scale));

  const boost = 1.25;
  ctx.filter = `grayscale(100%) contrast(${boost})`;
  ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const threshold = gray > 148 ? 255 : 0;
    data[i] = data[i + 1] = data[i + 2] = threshold;
  }

  ctx.putImageData(imageData, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height
  };
}

let tesseractWorker = null;
async function getTesseractWorker() {
  if (tesseractWorker) return tesseractWorker;
  tesseractWorker = await Tesseract.createWorker('eng+chi_tra', 1, {
    cacheMethod: 'write', // V4.4: 語系緩存加速
    logger: m => console.log(m)
  });
  return tesseractWorker;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('圖片載入失敗'));
    };
    img.src = objectUrl;
  });
}

async function handleOCR(file) {
  const status = document.getElementById('ocr-status');
  if (!file) return;
  if (typeof Tesseract === 'undefined') {
    if (status) status.textContent = 'Tesseract 未載入，請檢查網路。';
    return;
  }

  if (status) {
    status.textContent = '圖片優化與解析中…';
    status.style.color = 'inherit';
  }

  const timeoutMsg = setTimeout(() => {
    if (status) {
      status.textContent = '圖片解析中，請稍候或手動輸入。';
      status.style.color = 'orange';
    }
  }, 20000);

  try {
    const img = await loadImageFromFile(file);
    const processed = await preprocessImage(img);
    const worker = await getTesseractWorker();
    const { data } = await worker.recognize(processed.dataUrl);

    clearTimeout(timeoutMsg);

    const rawText = (data?.text || '').trim();
    console.log('[OCR raw text]', rawText);

    const filteredWords = (data?.words || [])
      .filter((word) => word?.text?.trim())
      .filter((word) => word?.bbox?.y0 > processed.height * 0.03);

    const result = smartOCR({
      words: filteredWords,
      fullText: rawText
    });

    if (status) {
      status.textContent = result.message;
      status.style.color = result.color || 'inherit';
    }
  } catch (err) {
    clearTimeout(timeoutMsg);
    if (status) {
      status.textContent = `辨識失敗：${err.message || err}`;
      status.style.color = 'red';
    }
  }
}

function initOcrUpload() {
  const input = document.getElementById('ocr-upload');
  if (!input) return;

  input.addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      await handleOCR(file);
    } finally {
      input.value = '';
    }
  });
}

/**
 * V4.3: 日期自動偵測
 * 尋找 YYYY/MM/DD 或 YYYY年MM月DD日 格式
 */
function detectDate(text) {
  const regex = /\d{4}[\/年]\d{1,2}[\/月]\d{1,2}/;
  const match = text.match(regex);
  if (match) {
    const dateStr = match[0].replace(/[年月]/g, '-').replace(/\//g, '-').replace(/日/g, '');
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  return null;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractFirstMatch(text, patterns, mapper = null) {
  const list = Array.isArray(patterns) ? patterns : [patterns];
  for (const pattern of list) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = mapper ? mapper(match) : (match[1] ?? match[0]);
    if (value != null && value !== '') return value;
  }
  return null;
}

function extractLabeledValue(text, labels, valuePattern, flags = 'i') {
  const labelPattern = (Array.isArray(labels) ? labels : [labels]).map(escapeRegex).join('|');
  return extractFirstMatch(text, [
    new RegExp(`(?:${labelPattern})[\\s\\S]{0,24}?(${valuePattern})`, flags),
    new RegExp(`(${valuePattern})[\\s\\S]{0,24}?(?:${labelPattern})`, flags)
  ]);
}

function applyOcrNumbers(text) {
  const numbers = (text.match(/\d+(?:\.\d+)?/g) || []).filter(Boolean);
  const firstDecimal = numbers.find((value) => value.includes('.'));
  if (firstDecimal) setFieldValue('f-dist', firstDecimal);
}

function extractRunningMetrics(text) {
  return {
    distance: extractLabeledValue(text, ['Distance', 'Distance (km)'], '\\d+(?:\\.\\d+)?'),
    duration: extractFirstMatch(text, [
      /Duration[\s\S]{0,20}?(\d{1,2}:\d{2}:\d{2})/i,
      /(\d{1,2}:\d{2}:\d{2})[\s\S]{0,20}?Duration/i
    ]),
    avgPace: extractLabeledValue(text, ['Average Pace', 'Pace'], '\\d{1,2}:\\d{2}'),
    avgSpeed: extractLabeledValue(text, ['Average Speed'], '\\d+(?:\\.\\d+)?'),
    maxSpeed: extractLabeledValue(text, ['Max. Speed', 'Max Speed'], '\\d+(?:\\.\\d+)?'),
    ascent: extractLabeledValue(text, ['Elevation Gain'], '\\d+'),
    descent: extractLabeledValue(text, ['Elevation Loss'], '\\d+'),
    maxAlt: extractLabeledValue(text, ['Max. Elevation', 'Max Elevation'], '\\d+')
  };
}

function extractHikingbookMetrics(text) {
  const metrics = {
    distance: extractLabeledValue(text, ['距離'], '\\d+(?:\\.\\d+)?'),
    avgSpeed: extractLabeledValue(text, ['平均速度'], '\\d+(?:\\.\\d+)?'),
    ascent: extractLabeledValue(text, ['總爬升'], '\\d+'),
    descent: extractLabeledValue(text, ['總下降'], '\\d+')
  };

  const timeMatch = text.match(/時間[\s\S]{0,20}?(\d+)\s*時[\s\S]{0,12}?(\d+)\s*分/);
  if (timeMatch) {
    metrics.hours = timeMatch[1];
    metrics.minutes = timeMatch[2];
  }

  const allIntegers = (text.match(/\d+/g) || []).map(Number).filter(Number.isFinite);
  const chartCandidates = allIntegers.filter((value) => value >= 20 && value <= 500);
  if (chartCandidates.length >= 2) {
    const lastTwo = chartCandidates.slice(-2);
    const diff = Math.abs(lastTwo[0] - lastTwo[1]);
    if (diff > 0) metrics.elevGain = diff;
  }

  return metrics;
}

function extractPacerMetrics(text) {
  const metrics = {
    distance: extractLabeledValue(text, ['公里'], '\\d+(?:\\.\\d+)?'),
    calories: extractLabeledValue(text, ['大卡'], '\\d+'),
    steps: extractFirstMatch(text, [
      /(\d{3,5})[\s\S]{0,20}?步數目標/,
      /步數目標[:：]?\s*\d+[\s\S]{0,20}?(\d{3,5})/
    ])
  };

  const timeMatch = text.match(/(?:活躍時間)?[\s\S]{0,12}?(\d+)\s*h[\s\S]{0,8}?(\d+)\s*m/i);
  if (timeMatch) {
    metrics.hours = timeMatch[1];
    metrics.minutes = timeMatch[2];
  }

  return metrics;
}

function normalizeOcrWords(words) {
  return (words || [])
    .filter((word) => word?.text?.trim() && word?.bbox)
    .map((word) => {
      const text = word.text.trim();
      const bbox = word.bbox;
      return {
        ...word,
        text,
        bbox,
        centerX: (bbox.x0 + bbox.x1) / 2,
        centerY: (bbox.y0 + bbox.y1) / 2,
        width: Math.max(1, bbox.x1 - bbox.x0),
        height: Math.max(1, bbox.y1 - bbox.y0)
      };
    });
}

function detectOcrAppType(text) {
  if (/Distance|Duration|Average Pace/i.test(text)) return 'Running App';
  if (/Pacer|大卡|步數|步數目標/.test(text)) return 'Pacer';
  if (/Hikingbook|總爬升|平均速度|距離/.test(text)) return 'Hikingbook';
  return '';
}

function activateOcrForm(workoutType) {
  currentFormType = workoutType;
  const selector = document.getElementById('add-type-selector');
  const form = document.getElementById('workout-form');
  if (selector) selector.style.display = 'none';
  if (form) {
    form.className = `active-form-${workoutType}`;
    form.classList.remove('hidden');
  }
  renderFields(workoutType);

  const title = document.getElementById('add-view-title');
  if (title) title.innerText = `新增${typeLabel(workoutType)}紀錄 (OCR)`;

  const colors = { run: '#ffebee', walk: '#fff9c4', climb: '#e3f2fd', gym: '#f3e5f5' };
  const overlay = document.getElementById('add-view');
  if (overlay) overlay.style.backgroundColor = colors[workoutType] || '';
  document.body.style.backgroundColor = colors[workoutType] || '';
}

function findNearbyValue(words, keywords, valueType, options = {}) {
  const {
    directions = ['right'],
    maxDistance = 220,
    sameRowTolerance = 0.9,
    sameColTolerance = 1.3,
    preferDecimal = false
  } = options;

  const keywordList = Array.isArray(keywords) ? keywords : [keywords];
  const normalizedWords = normalizeOcrWords(words);
  const keywordRegex = new RegExp(keywordList.map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  const valueRegex = valueType === 'time'
    ? /^\d{1,2}:\d{2}(?::\d{2})?$/
    : valueType === 'int'
      ? /^\d{1,6}$/
      : /^\d+(?:\.\d+)?$/;

  let bestMatch = null;

  normalizedWords.forEach((anchor) => {
    if (!keywordRegex.test(anchor.text)) return;

    normalizedWords.forEach((candidate) => {
      if (candidate === anchor) return;

      const candidateText = candidate.text.replace(/,/g, '');
      if (!valueRegex.test(candidateText)) return;
      if (preferDecimal && !candidateText.includes('.')) return;

      const horizontalGap = candidate.centerX - anchor.centerX;
      const verticalGap = candidate.centerY - anchor.centerY;
      const sameRow = Math.abs(verticalGap) <= Math.max(anchor.height, candidate.height) * sameRowTolerance;
      const sameCol = Math.abs(horizontalGap) <= Math.max(anchor.width, candidate.width) * sameColTolerance;

      let score = Infinity;
      for (const direction of directions) {
        if (direction === 'right' && sameRow && candidate.bbox.x0 >= anchor.bbox.x1) {
          score = Math.min(score, (candidate.bbox.x0 - anchor.bbox.x1) + Math.abs(verticalGap) * 0.6);
        }
        if (direction === 'left' && sameRow && candidate.bbox.x1 <= anchor.bbox.x0) {
          score = Math.min(score, (anchor.bbox.x0 - candidate.bbox.x1) + Math.abs(verticalGap) * 0.6);
        }
        if (direction === 'below' && sameCol && candidate.bbox.y0 >= anchor.bbox.y1) {
          score = Math.min(score, (candidate.bbox.y0 - anchor.bbox.y1) + Math.abs(horizontalGap) * 0.35);
        }
        if (direction === 'above' && sameCol && candidate.bbox.y1 <= anchor.bbox.y0) {
          score = Math.min(score, (anchor.bbox.y0 - candidate.bbox.y1) + Math.abs(horizontalGap) * 0.35);
        }
      }

      if (score <= maxDistance && (!bestMatch || score < bestMatch.score)) {
        bestMatch = { value: candidateText, score, word: candidate };
      }
    });
  });

  return bestMatch;
}

function parseDurationParts(durationText) {
  if (!durationText) return null;
  const parts = durationText.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return { hours: parts[0], minutes: parts[1], seconds: parts[2] };
  if (parts.length === 2) return { hours: parts[0], minutes: parts[1], seconds: 0 };
  return null;
}

function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el || value == null || value === '') return false;
  el.value = value;
  return true;
}

function findLargestStepCandidate(words, excludedValues = []) {
  const exclusionSet = new Set(excludedValues.filter(Boolean).map((value) => String(value).replace(/\D/g, '')));
  const normalizedWords = normalizeOcrWords(words);
  const stepAnchors = normalizedWords.filter((word) => /步數|步數目標/i.test(word.text));

  const candidates = normalizedWords
    .filter((word) => /^\d{4,5}$/.test(word.text.replace(/[,\s]/g, '')))
    .map((word) => {
      const numericText = word.text.replace(/[,\s]/g, '');
      const nearestAnchorDistance = stepAnchors.length
        ? Math.min(...stepAnchors.map((anchor) => Math.abs(word.centerY - anchor.centerY) + Math.abs(word.centerX - anchor.centerX) * 0.2))
        : 9999;
      return {
        word,
        numericText,
        fontScore: word.height * word.width,
        anchorDistance: nearestAnchorDistance
      };
    })
    .filter((candidate) => !exclusionSet.has(candidate.numericText))
    .sort((a, b) => {
      if (a.anchorDistance !== b.anchorDistance) return a.anchorDistance - b.anchorDistance;
      if (b.fontScore !== a.fontScore) return b.fontScore - a.fontScore;
      return Number(b.numericText) - Number(a.numericText);
    });

  if (candidates.length > 0) return candidates[0].numericText;

  const fallback = normalizedWords
    .filter((word) => /^\d{4,6}$/.test(word.text.replace(/[,\s]/g, '')))
    .map((word) => word.text.replace(/[,\s]/g, ''))
    .filter((value) => !exclusionSet.has(value))
    .sort((a, b) => Number(b) - Number(a));

  return fallback[0] || null;
}

function smartOCR({ words, fullText }) {
  const status = document.getElementById('ocr-status');
  const rawText = (fullText || '').trim();
  const originalText = rawText.replace(/\s+/g, ' ').trim();
  const normalizedWords = normalizeOcrWords(words);

  const detectedDate = detectDate(originalText);
  if (detectedDate) {
    setFieldValue('f-date', detectedDate);
  }
  const text = originalText.replace(/\d{4}[\/年]\d{1,2}[\/月]\d{1,2}日?/g, '').trim();
  console.log('[OCR sanitized text]', text);

  const appType = detectOcrAppType(text);

  if (!appType) {
    applyOcrNumbers(text);
    return {
      message: detectedDate ? '已抓到日期，其餘欄位請手動確認。' : '無法判斷 App 模板，請手動校對。',
      color: detectedDate ? 'orange' : 'red'
    };
  }

  let workoutType = 'run';
  if (appType === 'Hikingbook') workoutType = 'climb';
  if (appType === 'Pacer') workoutType = 'walk';
  activateOcrForm(workoutType);

  let successCount = 0;
  const markSuccess = (fieldId, value) => {
    if (setFieldValue(fieldId, value)) successCount++;
  };

  if (appType === 'Running App') {
    const metrics = extractRunningMetrics(rawText);
    const distMatch = metrics.distance ? { value: metrics.distance } : findNearbyValue(normalizedWords, 'Distance', 'num', {
      directions: ['left', 'right', 'above', 'below'],
      maxDistance: 320,
      preferDecimal: true
    });
    if (distMatch) markSuccess('f-dist', distMatch.value);

    const durationMatch = metrics.duration ? { value: metrics.duration } : findNearbyValue(normalizedWords, 'Duration', 'time', {
      directions: ['right', 'below', 'left'],
      maxDistance: 360
    });
    const durationText = durationMatch?.value || text.match(/\d{1,2}:\d{2}:\d{2}/)?.[0] || '';
    const duration = parseDurationParts(durationText);
    if (duration) {
      markSuccess('f-hr', duration.hours);
      markSuccess('f-min', duration.minutes);
    }

    const paceMatch = metrics.avgPace ? { value: metrics.avgPace } : findNearbyValue(normalizedWords, ['Average Pace', 'Pace'], 'time', {
      directions: ['right', 'below'],
      maxDistance: 260
    });
    if (paceMatch) markSuccess('f-avg-pace', paceMatch.value);

    const avgSpeedMatch = metrics.avgSpeed ? { value: metrics.avgSpeed } : findNearbyValue(normalizedWords, ['Average Speed', 'Speed'], 'num', {
      directions: ['right', 'below'],
      maxDistance: 260
    });
    if (avgSpeedMatch) markSuccess('f-avg-speed', avgSpeedMatch.value);

    const maxSpeedMatch = metrics.maxSpeed ? { value: metrics.maxSpeed } : findNearbyValue(normalizedWords, ['Max. Speed', 'Max Speed'], 'num', {
      directions: ['right', 'below'],
      maxDistance: 260
    });
    if (maxSpeedMatch) markSuccess('f-max-speed', maxSpeedMatch.value);

    const ascentMatch = metrics.ascent ? { value: metrics.ascent } : findNearbyValue(normalizedWords, ['Elevation Gain', 'Gain'], 'int', {
      directions: ['right', 'below'],
      maxDistance: 260
    });
    if (ascentMatch) markSuccess('f-ascent', ascentMatch.value);

    const descentMatch = metrics.descent ? { value: metrics.descent } : findNearbyValue(normalizedWords, ['Elevation Loss', 'Loss'], 'int', {
      directions: ['right', 'below'],
      maxDistance: 260
    });
    if (descentMatch) markSuccess('f-descent', descentMatch.value);

    const maxAltMatch = metrics.maxAlt ? { value: metrics.maxAlt } : findNearbyValue(normalizedWords, ['Max. Elevation', 'Max Elevation'], 'int', {
      directions: ['right', 'below'],
      maxDistance: 260
    });
    if (maxAltMatch) markSuccess('f-max-alt', maxAltMatch.value);
  } else if (appType === 'Hikingbook') {
    const metrics = extractHikingbookMetrics(rawText);
    const distMatch = metrics.distance ? { value: metrics.distance } : findNearbyValue(normalizedWords, '距離', 'num', {
      directions: ['below', 'right'],
      maxDistance: 260,
      preferDecimal: true
    });
    if (distMatch) markSuccess('f-dist', distMatch.value);

    const hourMatch = metrics.hours ? { value: metrics.hours } : findNearbyValue(normalizedWords, '時', 'int', {
      directions: ['left'],
      maxDistance: 160
    });
    if (hourMatch) markSuccess('f-hr', hourMatch.value);

    const minuteMatch = metrics.minutes ? { value: metrics.minutes } : findNearbyValue(normalizedWords, '分', 'int', {
      directions: ['left'],
      maxDistance: 160
    });
    if (minuteMatch) markSuccess('f-min', minuteMatch.value);

    const avgSpeedMatch = metrics.avgSpeed ? { value: metrics.avgSpeed } : findNearbyValue(normalizedWords, '平均速度', 'num', {
      directions: ['below', 'right'],
      maxDistance: 260
    });
    if (avgSpeedMatch) markSuccess('f-avg-speed', avgSpeedMatch.value);

    const ascentMatch = metrics.ascent ? { value: metrics.ascent } : findNearbyValue(normalizedWords, '總爬升', 'int', {
      directions: ['below', 'right'],
      maxDistance: 260
    });
    if (ascentMatch) markSuccess('f-ascent', ascentMatch.value);

    const descentMatch = metrics.descent ? { value: metrics.descent } : findNearbyValue(normalizedWords, '總下降', 'int', {
      directions: ['below', 'right'],
      maxDistance: 260
    });
    if (descentMatch) markSuccess('f-descent', descentMatch.value);

    if (metrics.elevGain) markSuccess('f-elev-gain', metrics.elevGain);
  } else if (appType === 'Pacer') {
    const metrics = extractPacerMetrics(rawText);
    const distMatch = metrics.distance ? { value: metrics.distance } : findNearbyValue(normalizedWords, ['公里', '距離'], 'num', {
      directions: ['below', 'left', 'right'],
      maxDistance: 260,
      preferDecimal: true
    });
    if (distMatch) markSuccess('f-dist', distMatch.value);

    const hourMatch = metrics.hours ? { value: metrics.hours } : findNearbyValue(normalizedWords, ['h', 'H'], 'int', {
      directions: ['left'],
      maxDistance: 120
    });
    if (hourMatch) markSuccess('f-hr', hourMatch.value);

    const minuteMatch = metrics.minutes ? { value: metrics.minutes } : findNearbyValue(normalizedWords, ['m', 'M', '分'], 'int', {
      directions: ['left'],
      maxDistance: 120
    });
    if (minuteMatch) markSuccess('f-min', minuteMatch.value);

    const calorieMatch = metrics.calories ? { value: metrics.calories } : findNearbyValue(normalizedWords, '大卡', 'int', {
      directions: ['left', 'right'],
      maxDistance: 160
    });
    if (calorieMatch) {
      console.log('[OCR pacer calories]', calorieMatch.value);
    }

    const steps = metrics.steps || findLargestStepCandidate(normalizedWords, [calorieMatch?.value, '10000']);
    if (steps) markSuccess('f-steps', steps);
  }

  if (successCount < 1) {
    return {
      message: '辨識結果不完整，請手動校對。',
      color: 'red'
    };
  }

  const keyFields = workoutType === 'walk'
    ? ['f-dist', 'f-steps']
    : ['f-dist', 'f-hr', 'f-min'];
  const hasZeroOrNull = keyFields.some((fieldId) => {
    const el = document.getElementById(fieldId);
    return el && (el.value === '' || Number(el.value) === 0);
  });

  if (hasZeroOrNull) {
    return {
      message: `已偵測到 [${appType}]，但部分欄位可能偏移，請檢查距離與時間。`,
      color: 'orange'
    };
  }

  if (status) status.style.color = 'inherit';
  return {
    message: `已偵測到 [${appType}] 數據，已自動填入。`,
    color: 'inherit'
  };
}

function clearFormInputs() {
  const inputs = document.querySelectorAll('#workout-form input[type="number"], #workout-form input[type="text"]');
  inputs.forEach(input => {
    if (input.id !== 'f-date') input.value = '';
  });
  const status = document.getElementById('ocr-status');
  if (status) {
    status.textContent = '';
    status.style.color = 'inherit';
  }
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
  renderCalendar();
  btn?.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    renderCalendar();
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
