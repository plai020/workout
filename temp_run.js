const fs = require('fs');
const script = fs.readFileSync('./script.js', 'utf8');

const evalCode = `
function fixOcrTypos(text) {
  return text
    .replace(/\\b[O०o]\\d/g, match => '0' + match.substring(1))
    .replace(/\\d[O०o]\\b/g, match => match[0] + '0')
    .replace(/\\b[lI]\\.\\d/g, match => '1' + match.substring(1))
    .replace(/\\b[Zz]\\.\\d/g, match => '2' + match.substring(1))
    .replace(/\\b[Ss]\\.\\d/g, match => '5' + match.substring(1))
    .replace(/\\b[Bb]\\.\\d/g, match => '8' + match.substring(1))
    .replace(/(\\d)[O०o](\\d)/g, '$10$2')
    .replace(/(\\d)[lI](\\d)/g, '$11$2')
    .replace(/(\\d)[Zz](\\d)/g, '$12$2')
    .replace(/(\\d)[Ss](\\d)/g, '$15$2')
    .replace(/(\\d)[Bb](\\d)/g, '$18$2');
}

function stripOcrNoise(text) {
  const fixedText = fixOcrTypos(text || '');
  return String(fixedText)
    .replace(/(?:19|20)\\d{2}\\s*[\\/\\-年\\.]\\s*\\d{1,2}\\s*[\\/\\-月\\.]\\s*\\d{1,2}\\s*日?/g, ' ')
    .replace(/^(?:\\[\\|\\s*)?\\d{1,2}:\\d{2}(?:\\s*,)?\\s*(?:ol|oil|as|il|all)?\\s*(?:4G|5G)?/gim, ' ')
    .replace(/\\b(?:4G|5G|GPS|Progress|kCal)\\b/gi, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^\\$\\{\\}()|[\\]\\\\]/g, '\\\\$&');
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
    new RegExp(\`(?:\\$\\{labelPattern\\})[\\\\s\\\\S]{0,24}?(\\$\\{valuePattern\\})\`, flags),
    new RegExp(\`(\\$\\{valuePattern\\})[\\\\s\\\\S]{0,24}?(?:\\$\\{labelPattern\\})\`, flags)
  ]);
}

function toYMD(d) {
  return d.toISOString().split('T')[0];
}

function extractStepsAppMetrics(text) {
  const cleaned = stripOcrNoise(text);
  const metrics = {};

  const today = new Date();
  if (/今天/.test(cleaned)) {
    metrics.date = toYMD(today);
  } else if (/昨日/.test(cleaned)) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    metrics.date = toYMD(yesterday);
  } else {
    const dMatch = cleaned.match(/\\d{4}\\s*[\\/\\-年]\\s*\\d{1,2}\\s*[\\/\\-月]\\s*\\d{1,2}(?:\\s*日)?/);
    if (dMatch) {
      metrics.date = dMatch[0]
        .replace(/\\s*/g, '')
        .replace(/[年月]/g, '-')
        .replace(/日/g, '')
        .replace(/\\//g, '-');
    }
  }

  // Sequence match for Streak / Calories / Distance / Time
  const seqMatch = cleaned.match(/(?:®?\\d+|os)[^\\d,/#]+(\\d{2,4})[^\\d,/#]+(\\d+(?:\\.\\d+)?)[^\\d,/#]+(\\d+[:：]\\d+|\\d{1,3})(?:[^\\d]|$)/);
  if (seqMatch) {
    metrics.calories = seqMatch[1];
    metrics.distance = seqMatch[2];
    const timeStr = seqMatch[3];
    if (timeStr.includes(':') || timeStr.includes('：')) {
      const parts = timeStr.split(/[:：]/);
      metrics.hours = parts[0];
      metrics.minutes = parts[1];
    } else {
      metrics.hours = '0';
      metrics.minutes = timeStr;
    }
  }

  // Fallback labeled extraction
  if (!metrics.distance) metrics.distance = extractLabeledValue(cleaned, ['公里'], '\\\\d+(?:\\\\.\\\\d+)?');
  if (!metrics.calories) metrics.calories = extractLabeledValue(cleaned, ['千卡'], '\\\\d{2,4}');
  
  if (!metrics.hours && !metrics.minutes) {
    const hrMinMatch = cleaned.match(/(\\d+)[:：](\\d+)\\s*[小小時]/);
    if (hrMinMatch) {
      metrics.hours = hrMinMatch[1];
      metrics.minutes = hrMinMatch[2];
    } else {
      const hrMatch = extractLabeledValue(cleaned, ['小時'], '\\\\d+');
      const minMatch = extractLabeledValue(cleaned, ['分鐘'], '\\\\d+');
      if (hrMatch) metrics.hours = hrMatch;
      if (minMatch) metrics.minutes = minMatch;
    }
  }

  const stepMatch = cleaned.match(/(\\d{1,3}(?:[,\\s]\\d{3})+|\\d{4,6})(?=\\s*步)/);
  if (stepMatch) {
    metrics.steps = stepMatch[1].replace(/[,\\s]/g, '');
  } else {
    const exclusions = new Set(['2024', '2025', '2026', '2027', '4500', '5000', '10000']);
    if (metrics.calories) exclusions.add(String(metrics.calories).replace(/\\D/g, ''));
    const stepCandidates = (cleaned.match(/\\d{3,6}/g) || [])
      .filter((val) => !exclusions.has(val));
    if (stepCandidates.length > 0) {
      metrics.steps = stepCandidates
        .map(Number)
        .filter((value) => value >= 1000 && value <= 200000)
        .sort((a, b) => b - a)[0]?.toString() || null;
    }
  }

  if (metrics.distance && !metrics.distance.includes('.')) {
    metrics.distance = (Number(metrics.distance) / 10).toFixed(1);
  }

  return metrics;
}

const text1 = 'ha ol 4G BY © i] . 20264 48270 32,976 © had 764® 201% 515° @ ! PR 我 32,976 248 ail 4G @8% 全 日 週 月 see 32,976 #/4,500 ®3 764% 20.1% 5:15° Streak SFE 公里 小 時 【 週 五 #@x #8 EE 。 過 二 B= Em ny. uN 1 © PR 我 32,976 會 空 O° Jd PES : Groupin 32,976 # 14,500 % I" Ye) E—c © — | (55575) 3 764 20.1 5:15 | 、 週 一, 0 ¢ gee ® g 3 764 20.1 51';
const text2 = 'ot 4c BB Fe! 日 sen 4,633 全 駒 3 112 2.9 44 @ CL oR x 4,633 6 2 0 0 + BE 99 (250 al 4G @8% & 日 # 月 ee 4,633 3% /4,500 & ®3 112 2.9 44 E Streak SFE RE 分 鐘 : 點 LLL ! @ PR@ _— 會 2 O49 k WEE [RTO (GN Zo 4,633 # 14,500 % I" Ye) 119 270 NAA ® 2026F 4H 24H 4,633 3 112 2.9 44 3 112 2.9 44';
const text3 = '- oil 4G iB 15 B ,,, 今天 4,142 3 109 2.8 39 © - |] 1 PR 我 7,691 ov as 250 ail 4G @8% 全 日 週 月 see 今天 4,142 3% /4,500 & [@ ®3 109 2.8 39 Streak FE RE 分 鐘 : 0 3 6 9 12 is 18 21 0 A 1 © PR % Zool 會 空 O° Jd PE : Groupin 今天 4,142 步 / 4,500 步 了 Ye) 100 7 Q 20 ® (.:.) 3 109 2.8 39 3 109 RS 39';
const text4 = '- ofl 4G @B# © i] . 昨日 = 7,691 S os 192 50 1:13® Fail PR # 7,691 250 ail 4G @8% 全 日 週 月 see 昨日 7,691 步 / 4,500 % ®3 192 5.0 © 1:13% Streak SFE 公里 小 時 0 3 6 9 12 is 18 21 0 Lal... 1 © PR 我 7,691 會 空 O° Jd PE : Groupin 昨日 7,691 # 14,500 % = I" Ye) 109 Lo pc (7601) 3 192 50 1:13 3 192 5.0 1:1';

console.log('Result 1:', extractStepsAppMetrics(text1));
console.log('Result 2:', extractStepsAppMetrics(text2));
console.log('Result 3:', extractStepsAppMetrics(text3));
console.log('Result 4:', extractStepsAppMetrics(text4));
`;
eval(evalCode);
