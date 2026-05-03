const extractStepsAppMetrics = (text) => {
  const cleaned = text; 
  const metrics = {};

  const regex = /(?<![\d,])(?:®?\d+|os|0s)[%®©|E\s]+(\d{2,4})[%®©|E\s]+(\d+(?:\.\d+)?)[%®©|E\s]+(\d+[:：]\d{2}|\d{2,3})(?=[^\d]|$)/g;
  const matches = [...cleaned.matchAll(regex)];
  console.log('Matches:', matches.map(m => m[0]));
  
  if (matches.length > 0) {
    let bestMatch = null;
    let bestScore = -1;
    for (const m of matches) {
      let score = 0;
      if (m[2].includes('.')) score += 2;
      if (m[3].includes(':') || m[3].includes('：')) score += 2;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = m;
      }
    }
    
    console.log('Picked:', bestMatch[0]);
    metrics.calories = bestMatch[1];
    metrics.distance = bestMatch[2];
    const timeStr = bestMatch[3];
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

const text5 = `12:20 , 26 80s
0; 日 ves
昨日
24,510
®5 702 ® 18.4% 3:20®`;

console.log(extractStepsAppMetrics(text5));
