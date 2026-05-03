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

const extractStepsAppMetrics = (text) => {
  const cleaned = stripOcrNoise(text);
  console.log('Cleaned text:', cleaned);
  const metrics = {};

  const seqMatch = cleaned.match(/(?<![\d,])(?:®?\d+|os|0s)[%®©|E\s]+(\d{2,4})[%®©|E\s]+(\d+(?:\.\d+)?)[%®©|E\s]+(\d+[:：]\d+|\d{1,3})(?:[^\d]|$)/);
  if (seqMatch) {
    console.log('seqMatch:', seqMatch);
    metrics.calories = seqMatch[1];
    metrics.distance = seqMatch[2];
    const timeStr = seqMatch[3];
    if (timeStr.includes(':') || timeStr.includes('：')) {
      const parts = timeStr.split(/[:：]/);
      metrics.hours = parts[0];
      metrics.minutes = parts[1];
    } else {
      if (timeStr.length >= 3) {
        metrics.hours = timeStr.slice(0, -2);
        metrics.minutes = timeStr.slice(-2);
      } else {
        metrics.hours = '0';
        metrics.minutes = timeStr;
      }
    }
  } else {
    console.log('seqMatch: none');
  }

  return metrics;
};

const text6 = `8:45 ow 4G 72%
全 圖 ves
2026 E5818
24,510
96 702 ® 18.4% 3:200%

ia
1 PR 我 24,510
-_
會 @ CO 9 +
XY 4.87 K Cames=
8:45 wii 4G @
0 日 週 月 see
2026 年 5 月 1 日
24,510
% [4,500 %
®6 702 9 18.4% 3:20%
Streak 千 卡 公里 小 時 【

#2 週 二 #= an @B) =&x #8
LNB N

s 24,510
© rn
6 2 © 4 |
2 ght
BE lis 5 Nest EntmEs
EER) HE
2026 年 5 月 1 日
24,510
# 14,500 %
0
"YA 200 ® 19 7@ 2.2o 寢
(2:50)
6 702 © 18.4 3:29
CD
®
©
|]
6 702 18.4 3:2`;

console.log(extractStepsAppMetrics(text6));
