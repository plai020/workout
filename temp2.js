const fs = require('fs');
function detectDate(text) {
  const regex = /\d{4}\s*[\/\-年\.]\s*\d{1,2}\s*[\/\-月\.]\s*\d{1,2}/;
  const match = text.match(regex);
  if (match) {
    const dateStr = match[0].replace(/\s*/g, '').replace(/[年月]/g, '-').replace(/[\/\.]/g, '-').replace(/日/g, '');
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
const txt = `ha ol 4G BY
© i] .
20264 48270
32,976
©
had 764® 201% 515°
@
! PR 我 32,976
248 ail 4G @8%
全 日 週 月 see
2026 年 4 月 27 日`;
console.log('Date:', detectDate(txt));
