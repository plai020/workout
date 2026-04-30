const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

// 1. Add URL loading to DOMContentLoaded
code = code.replace(/initBackupImport\(\);/, 'initBackupImport();\n  initGoogleSheetsSync();');

// 2. Append the functions to the end of the file
const newCode = `

// --- Google Sheets 同步 ---
function initGoogleSheetsSync() {
  const urlInput = document.getElementById('gsheets-url');
  if (urlInput) {
    urlInput.value = localStorage.getItem('gsheets_url') || '';
  }
}

async function syncToGoogleSheets() {
  const urlInput = document.getElementById('gsheets-url');
  if (!urlInput) return;
  const url = urlInput.value.trim();
  
  if (!url) {
    alert('請輸入 Google Sheets Web App URL！');
    return;
  }
  
  localStorage.setItem('gsheets_url', url);
  
  const btn = document.querySelector('button[onclick="syncToGoogleSheets()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ 正在同步中...';
  btn.disabled = true;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(records),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });
    
    const result = await response.json();
    if (result.status === 'success') {
      alert(\`同步成功！新增了 \${result.addedCount} 筆紀錄。\`);
    } else {
      alert('同步失敗：' + (result.message || '未知錯誤'));
    }
  } catch (err) {
    alert('網路錯誤或跨網域請求失敗，請檢查 URL 或是網路連線。錯誤訊息：' + err.message);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}
`;

fs.writeFileSync('script.js', code + newCode);
console.log('done');
