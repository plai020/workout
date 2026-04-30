const fs = require('fs');
let code = fs.readFileSync('script.js', 'utf8');

const regex1 = /function extractPacerMetrics\(text\) \{[\s\S]*?return metrics;\n\}/g;
const newFunc = `function extractStepsAppMetrics(text) {
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
    const dMatch = text.match(/\\d{4}\\s*年\\s*\\d{1,2}\\s*月\\s*\\d{1,2}\\s*日/);
    if (dMatch) {
      metrics.date = dMatch[0]
        .replace(/\\s*/g, '')
        .replace('年', '-')
        .replace('月', '-')
        .replace('日', '');
    }
  }

  metrics.distance = extractLabeledValue(cleaned, ['公里'], '\\\\d+(?:\\\\.\\\\d+)?');
  metrics.calories = extractLabeledValue(cleaned, ['千卡'], '\\\\d{2,4}');
  
  const hrMinMatch = cleaned.match(/(\\\\d+)[:：](\\\\d+)\\s*小時/);
  if (hrMinMatch) {
    metrics.hours = hrMinMatch[1];
    metrics.minutes = hrMinMatch[2];
  } else {
    const hrMatch = extractLabeledValue(cleaned, ['小時'], '\\\\d+');
    const minMatch = extractLabeledValue(cleaned, ['分鐘'], '\\\\d+');
    if (hrMatch) metrics.hours = hrMatch;
    if (minMatch) metrics.minutes = minMatch;
  }

  const stepMatch = cleaned.match(/(\\\\d{1,3}(?:[,\\\\s]\\\\d{3})+|\\\\d{4,6})(?=\\s*步)/);
  if (stepMatch) {
    metrics.steps = stepMatch[1].replace(/[,\\\\s]/g, '');
  } else {
    const exclusions = new Set(['2024', '2025', '2026', '2027', '4500', '5000', '10000']);
    if (metrics.calories) exclusions.add(String(metrics.calories).replace(/\\D/g, ''));
    const stepCandidates = (cleaned.match(/\\\\d{3,6}/g) || [])
      .filter((val) => !exclusions.has(val));
    if (stepCandidates.length > 0) {
      metrics.steps = stepCandidates
        .map(Number)
        .filter((value) => value >= 1000 && value <= 200000)
        .sort((a, b) => b - a)[0]?.toString() || null;
    }
  }

  return metrics;
}`;

code = code.replace(regex1, newFunc);
code = code.replace(/cropPacerStepsFocus/g, 'cropStepsAppFocus');
code = code.replace(/pacerStepsResult/g, 'stepsAppStepsResult');
code = code.replace(/pacerStepsText/g, 'stepsAppStepsText');

code = code.replace(/const pacerMetrics = extractPacerMetrics\(combined\);/g, 'const stepsMetrics = extractStepsAppMetrics(combined);');
code = code.replace(/if \(\/步數目標\|活躍時間\|大卡\|公里\|202\\d年\\d\{1,2\}月\\d\{1,2\}日\/\.test\(combined\) && \(pacerMetrics\.steps \|\| pacerMetrics\.minutes \|\| pacerMetrics\.calories\)\) return 'Pacer';/g,
"if (/StepsApp|千卡|公里|今天|昨日|小時|分鐘|步/.test(combined) && (stepsMetrics.steps || stepsMetrics.minutes || stepsMetrics.calories || stepsMetrics.distance)) return 'StepsApp';");
code = code.replace(/if \(pacerMetrics\.distance && \(pacerMetrics\.steps \|\| pacerMetrics\.minutes \|\| pacerMetrics\.calories\)\) return 'Pacer';/g,
"if (stepsMetrics.distance && (stepsMetrics.steps || stepsMetrics.minutes || stepsMetrics.calories)) return 'StepsApp';");

code = code.replace(/if \(\/Pacer\|大卡\|步數\|步數目標\/\.test\(text\)\) return 'Pacer';/g, "if (/StepsApp|千卡|步數|今天|昨日/.test(text)) return 'StepsApp';");

code = code.replace(/const pacerMetricsForDate = extractPacerMetrics\(rawText\);/g, 'const stepsMetricsForDate = extractStepsAppMetrics(rawText);');
code = code.replace(/pacerMetricsForDate\.date/g, 'stepsMetricsForDate.date');

code = code.replace(/if \(appType === 'Pacer'\) workoutType = 'walk';/g, "if (appType === 'StepsApp') workoutType = 'walk';");
code = code.replace(/\} else if \(appType === 'Pacer'\) \{/g, "} else if (appType === 'StepsApp') {");

code = code.replace(/const metrics = extractPacerMetrics\(rawText\);/g, 'const metrics = extractStepsAppMetrics(rawText);');

fs.writeFileSync('script.js', code);
console.log('done');
