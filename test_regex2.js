const text1 = 'ha ol 4G BY © i] . 20264 48270 32,976 © had 764® 201% 515° @ ! PR 我 32,976 248 ail 4G @8% 全 日 週 月 see  32,976 #/4,500 ®3 764% 20.1% 5:15° Streak SFE 公里 小 時 【 週 五 #@x #8 EE 。 過 二 B= Em ny. uN 1 © PR 我 32,976 會 空 O° Jd PES : Groupin  32,976 # 14,500 % I" Ye) E—c © — | (55575) 3 764 20.1 5:15 | 、 週 一, 0 ¢ gee ® g 3 764 20.1 51';
const text2 = 'ot 4c BB Fe! 日 sen  4,633 全 駒 3 112 2.9 44 @ CL oR x 4,633 6 2 0 0 + BE 99 (250 al 4G @8% & 日 # 月 ee  4,633 3% /4,500 & ®3 112 2.9 44 E Streak SFE RE 分 鐘 : 點 LLL ! @ PR@ _— 會 2 O49 k WEE [RTO (GN Zo  4,633 # 14,500 % I" Ye) 119 270 NAA ® 2026F 4H 24H 4,633 3 112 2.9 44 3 112 2.9 44';
const text3 = '- oil 4G iB 15 B ,,, 今天 4,142 3 109 2.8 39 © - |] 1 PR 我 7,691 ov as 250 ail 4G @8% 全 日 週 月 see 今天 4,142 3% /4,500 & [@ ®3 109 2.8 39 Streak FE RE 分 鐘 : 0 3 6 9 12 is 18 21 0 A 1 © PR % Zool 會 空 O° Jd PE : Groupin 今天 4,142 步 / 4,500 步 了 Ye) 100 7 Q 20 ® (.:.) 3 109 2.8 39 3 109 RS 39';
const text4 = '- ofl 4G @B# © i] . 昨日 = 7,691 S os 192 50 1:13® Fail PR # 7,691 250 ail 4G @8% 全 日 週 月 see 昨日 7,691 步 / 4,500 % ®3 192 5.0 © 1:13% Streak SFE 公里 小 時 0 3 6 9 12 is 18 21 0 Lal... 1 © PR 我 7,691 會 空 O° Jd PE : Groupin 昨日 7,691 # 14,500 % = I" Ye) 109 Lo pc (7601) 3 192 50 1:13 3 192 5.0 1:1';

const regex = /(?:®?\d+|os|0s)\s*[%®©|E\s]*\s*(\d{2,4})\s*[%®©|E\s]*\s*(\d+(?:\.\d+)?)\s*[%®©|E\s]*\s*(\d+[:：]\d+|\d{1,3})(?:[^\d]|$)/;

console.log('1:', text1.match(regex));
console.log('2:', text2.match(regex));
console.log('3:', text3.match(regex));
console.log('4:', text4.match(regex));
