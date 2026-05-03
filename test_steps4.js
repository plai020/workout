const extractStepsAppMetrics = (text) => {
  const cleaned = text; 
  const metrics = {};

  const regex = /(?<![\d,])(?:®?\d+|os|0s)[%®©|E\s]+(\d{2,4})[%®©|E\s]+(\d+(?:\.\d+)?)[%®©|E\s]+(\d+[:：]\d{2}|\d{2,3})(?=[^\d]|$)/g;
  const matches = [...cleaned.matchAll(regex)];
  console.log('Matches:', matches.map(m => m[0]));
  
  if (matches.length > 0) {
    const seqMatch = matches[matches.length - 1]; // pick last match, or the one with time?
    console.log('Picked:', seqMatch[0]);
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
  }

  return metrics;
};

const text6 = `ow 72% 全 圖 ves 2026 E5818 24,510 96 702 ® 18.4% 3:200% ia 1 PR 我 24,510 -_ 會 @ CO 9 + XY 4.87 K Cames= wii @ 0 日 週 月 see 24,510 % [4,500 % ®6 702 9 18.4% 3:20% Streak 千 卡 公里 小 時 【 #2 週 二 #= an @B) =&x #8 LNB N s 24,510 © rn 6 2 © 4 | 2 ght BE lis 5 Nest EntmEs EER) HE 24,510 # 14,500 % 0 "YA 200 ® 19 7@ 2.20 寢 (2:50) 6 702 © 18.4 3:29 CD ® © |] 6 702 18.4 3:2`;

console.log(extractStepsAppMetrics(text6));
