const fixOcrTypos = (text) => {
  return text
    .replace(/\b[O०o]\d/g, match => '0' + match.substring(1))
    .replace(/\d[O०o]\b/g, match => match[0] + '0')
    .replace(/\b[lI]\.\d/g, match => '1' + match.substring(1))
    .replace(/\b[Zz]\.\d/g, match => '2' + match.substring(1))
    .replace(/\b[Ss]\.\d/g, match => '5' + match.substring(1))
    .replace(/\b[Bb]\.\d/g, match => '8' + match.substring(1))
    .replace(/(\d)[O०o](\d)/g, '$10$2')
    .replace(/(\d)[lI](\d)/g, '$11$2')
    .replace(/(\d)[Zz](\d)/g, '$12$2')
    .replace(/(\d)[Ss](\d)/g, '$15$2')
    .replace(/(\d)[Bb](\d)/g, '$18$2');
};

const stripOcrNoise = (text) => {
  const fixedText = fixOcrTypos(text || '');
  return String(fixedText)
    .replace(/(?:19|20)\d{2}\s*[\/\-年\.]\s*\d{1,2}\s*[\/\-月\.]\s*\d{1,2}\s*日?/g, ' ')
    .replace(/^(?:\[\|\s*)?\d{1,2}:\d{2}(?:\s*,)?\s*(?:ol|oil|as|il|all)?\s*(?:4G|5G)?/gim, ' ')
    .replace(/\b(?:4G|5G|GPS|Progress|kCal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

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
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractRunningMetrics(text) {
  const cleaned = stripOcrNoise(text);
  const topTriplet = cleaned.match(/(\d+(?:\.\d+)?)\s+(\d{1,2}:\d{2}:\d{2})\s+(\d{2,4})/);
  const metrics = {
    distance: extractFirstMatch(text, [
      /Distance[\s\S]{0,18}?(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*Distance\s*\(?.{0,6}\)?/i,
      /RUNNING[\s\S]{0,120}?(\d+(?:\.\d+)?)\s+(?:\d{1,2}:\d{2}:\d{2}|Duration)/i
    ]),
    duration: extractFirstMatch(text, [
      /Duration[\s\S]{0,20}?(\d{1,2}:\d{2}:\d{2})/i,
      /(\d{1,2}:\d{2}:\d{2})[\s\S]{0,20}?Duration/i,
      /RUNNING[\s\S]{0,120}?(\d{1,2}:\d{2}:\d{2})/i
    ]),
    avgPace: extractLabeledValue(text, ['Average Pace', 'Pace'], '\\d{1,2}:\\d{2}'),
    avgSpeed: extractLabeledValue(text, ['Average Speed'], '\\d+(?:\\.\\d+)?'),
  };

  console.log('topTriplet:', topTriplet);
  if (topTriplet?.[1]) {
    metrics.distance = topTriplet[1];
    metrics.duration = metrics.duration || topTriplet[2];
  }

  if (!metrics.duration) {
    const topDuration = cleaned.match(/(\d{1,2}:\d{2}:\d{2})/);
    if (topDuration) metrics.duration = topDuration[1];
  }

  if (metrics.distance && !metrics.distance.includes('.') && topTriplet?.[1]?.includes('.')) {
    metrics.distance = topTriplet[1];
  }

  return metrics;
}

const textRun = `9:55 ot 4G E
& 2026/5/2 - 7:24PM ii hdd
15.34 02:29:39 1,018
Distance (km] Duration Calories
dh Check out your rank in the >
leaderboard

©) Average Pace 09:45 min/km
= Average Speed 6.1 kph
= Max. Speed 14.3 kph
oo Step Length -
ay Elevation Gain 92m
ay Elevation Loss 94m
ay Max. Elevation 24m
$8 Average Heart Rate -
$& Max. Heart Rate -

圖 Dehydration 1,962 ml

四 oll

Progress
J`;

console.log(extractRunningMetrics(textRun));
