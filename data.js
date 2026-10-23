// Islands, outside connections and flows, re-described from the public structure of
// https://puma.taipei/heart-island (policies.json, checked 2026-10-22). Coordinates are
// pointy-top axial hexes (q, r); b is the island's policy item count. Flow text is our
// own Traditional Chinese (Taiwan) paraphrase, not the source copy.

export const islands = [
  { id: "civil", n: 1, en: "Civic core", zh: "市府核心", q: -1, r: 4, b: 6 },
  { id: "institute", n: 2, en: "Research Institute", zh: "台北研究院", q: 0, r: 3, b: 4 },
  { id: "transport", n: 3, en: "Transport", zh: "交通", q: -1, r: 5, b: 7 },
  { id: "education", n: 4, en: "Education", zh: "教育", q: -1, r: 2, b: 10 },
  { id: "lunch", n: 5, en: "School meals", zh: "營養午餐", q: 0, r: 2, b: 4 },
  { id: "family", n: 6, en: "Family support", zh: "家庭一站通", q: -1, r: 3, b: 6 },
  { id: "card", n: 7, en: "Family card", zh: "親子同行卡", q: -2, r: 3, b: 6 },
  { id: "welfare", n: 8, en: "Health & care", zh: "衛福與社會照顧", q: -2, r: 4, b: 14 },
  { id: "sport", n: 9, en: "Sport", zh: "運動", q: -2, r: 6, b: 8 },
  { id: "trails", n: 10, en: "Culture & trails", zh: "文化徑 × 山林徑", q: 1, r: 0, b: 9 },
  { id: "forest", n: 11, en: "Urban forest", zh: "都市微森林", q: 0, r: 1, b: 8 },
  { id: "youth", n: 12, en: "Youth", zh: "青年", q: 0, r: 4, b: 3 },
  { id: "diplomacy", n: 13, en: "City diplomacy", zh: "城市外交", q: 1, r: 1, b: 4 },
  { id: "hakka", n: 14, en: "Hakka", zh: "客家", q: -3, r: 4, b: 5 },
];

// Outside connections have no island in the source; placed on empty hexes next to
// the islands they serve.
export const ports = [
  { id: "police", en: "Police data", zh: "警政資料", q: 1, r: 3 },
  { id: "community", en: "Community", zh: "社區", q: -3, r: 6 },
  { id: "farm", en: "Local farmers", zh: "在地小農", q: 1, r: 2 },
];

// The source tags each flow with a story prop (energy, clock, folder…), which gives
// 15 kinds for 20 flows. These six groups are our judgment call, chosen so each
// resource has a network worth looking at. `short` labels the resource bar.
export const resources = [
  { id: "staff", key: "1", en: "Staff capacity", zh: "公務人力", short: "人力", blurb: "市府同仁的時間與專業，是其他政策得以運轉的基礎。" },
  { id: "data", key: "2", en: "Data & research", zh: "數據研究", short: "數據", blurb: "在各局處之間流動的資料、規劃與 AI 工具。" },
  { id: "knowhow", key: "3", en: "Know-how exchange", zh: "交流經驗", short: "交流", blurb: "與其他城市、學校和社區互相交換的經驗。" },
  { id: "care", key: "4", en: "Care & support", zh: "照顧支持", short: "照顧", blurb: "送到市民身邊的照顧、諮商與家庭支持。" },
  { id: "access", key: "5", en: "Access & benefits", zh: "通行福利", short: "通行", blurb: "讓市民跨服務通用的卡片與點數。" },
  { id: "supply", key: "6", en: "Space & supply", zh: "空間供給", short: "空間", blurb: "落在社區裡的空間、綠蔭與食物。" },
];

// from/to may list several nodes; every from × to pair is one edge. two = two-way.
export const flows = [
  { id: "F1", res: "staff", from: ["civil"], to: ["institute", "transport", "education", "lunch", "family", "card", "welfare", "sport", "trails", "forest", "youth", "diplomacy", "hakka"], text: "先減輕市府同仁的負擔，騰出推動其他政策的人力。" },
  { id: "F2", res: "staff", from: ["civil"], to: ["welfare"], text: "市府率先擴大彈性上下班，為友善家庭的職場做示範。" },
  { id: "F19", res: "staff", from: ["hakka"], to: ["civil"], text: "臨櫃與 1999 專線等職缺招募時，客語能力可以加分。" },

  { id: "F3", res: "data", from: ["institute"], to: ["welfare", "transport", "education"], text: "研究院為社福、交通與教育提供長期規劃支援。" },
  { id: "F4", res: "data", from: ["education", "welfare", "police"], to: ["institute"], text: "學校、社政與警政資料匯流，支撐兒少安全工作。" },
  { id: "F12", res: "data", from: ["civil"], to: ["youth", "education"], two: true, text: "AI 支援服務同時照顧青年、校園與市府同仁。" },

  { id: "F5", res: "knowhow", from: ["diplomacy"], to: ["transport", "forest"], text: "把海外在交通、都市林與住宅上的經驗帶回台北。" },
  { id: "F6", res: "knowhow", from: ["transport", "education"], to: ["diplomacy"], two: true, text: "與姊妹市互相交流通學路安全的做法。" },
  { id: "F15", res: "knowhow", from: ["diplomacy"], to: ["youth"], two: true, text: "青年計畫接上國際城市網絡，培養市民外交人才。" },
  { id: "F17", res: "knowhow", from: ["hakka"], to: ["education"], text: "台北學校與客庄學校結盟，寒暑假互相拜訪。" },
  { id: "F20", res: "knowhow", from: ["hakka"], to: ["diplomacy"], text: "讓客家文化在城市的國際論壇上發聲。" },

  { id: "F8", res: "care", from: ["sport"], to: ["welfare", "community"], text: "社區運動課程陪長輩動起來，也多些往來。" },
  { id: "F10", res: "care", from: ["family"], to: ["education", "card"], two: true, text: "育兒支持、家庭教育與親子共學一起推進。" },
  { id: "F11", res: "care", from: ["welfare", "family"], to: ["civil", "education"], two: true, text: "心理支持從家庭、校園一路延伸到市府職場。" },
  { id: "F16", res: "care", from: ["hakka"], to: ["welfare"], text: "長輩據點串連社區照顧，讓老少一起學習。" },

  { id: "F9", res: "access", from: ["card"], to: ["welfare"], two: true, text: "親子卡與敬老卡互通，祖孫可以一起出門。" },
  { id: "F18", res: "access", from: ["hakka"], to: ["card", "trails"], text: "用台北通累積客語點數，引導市民走進客家街區。" },

  { id: "F7", res: "supply", from: ["transport"], to: ["sport", "trails"], two: true, text: "運動驛站把通勤、運動和登山串在一起。" },
  { id: "F13", res: "supply", from: ["forest"], to: ["sport"], two: true, text: "微森林結合運動空間，把綠蔭帶進社區。" },
  { id: "F14", res: "supply", from: ["farm"], to: ["lunch", "education"], text: "在地小農供應校園午餐與食農教育。" },
];
