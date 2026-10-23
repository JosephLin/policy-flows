// Islands, outside connections and flows, re-described from the public structure of
// https://puma.taipei/heart-island (policies.json, checked 2026-10-22). Coordinates are
// pointy-top axial hexes (q, r). Flow text is our own paraphrase, not the source copy.

export const islands = [
  { id: "civil", n: 1, en: "Civic core", zh: "市府核心", q: -1, r: 4 },
  { id: "institute", n: 2, en: "Research Institute", zh: "台北研究院", q: 0, r: 3 },
  { id: "transport", n: 3, en: "Transport", zh: "交通", q: -1, r: 5 },
  { id: "education", n: 4, en: "Education", zh: "教育", q: -1, r: 2 },
  { id: "lunch", n: 5, en: "School meals", zh: "營養午餐", q: 0, r: 2 },
  { id: "family", n: 6, en: "Family support", zh: "家庭一站通", q: -1, r: 3 },
  { id: "card", n: 7, en: "Family card", zh: "親子同行卡", q: -2, r: 3 },
  { id: "welfare", n: 8, en: "Health & care", zh: "衛福與社會照顧", q: -2, r: 4 },
  { id: "sport", n: 9, en: "Sport", zh: "運動", q: -2, r: 6 },
  { id: "trails", n: 10, en: "Culture & trails", zh: "文化徑 × 山林徑", q: 1, r: 0 },
  { id: "forest", n: 11, en: "Urban forest", zh: "都市微森林", q: 0, r: 1 },
  { id: "youth", n: 12, en: "Youth", zh: "青年", q: 0, r: 4 },
  { id: "diplomacy", n: 13, en: "City diplomacy", zh: "城市外交", q: 1, r: 1 },
  { id: "hakka", n: 14, en: "Hakka", zh: "客家", q: -3, r: 4 },
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
// resource has a network worth looking at.
export const resources = [
  { id: "staff", key: "1", en: "Staff capacity", zh: "公務人力", blurb: "City staff time and skills that every other policy runs on." },
  { id: "data", key: "2", en: "Data & research", zh: "數據研究", blurb: "Shared data, planning and AI tools moving between departments." },
  { id: "knowhow", key: "3", en: "Know-how exchange", zh: "交流經驗", blurb: "Experience traded with other cities, schools and communities." },
  { id: "care", key: "4", en: "Care & support", zh: "照顧支持", blurb: "Care, counseling and family programs delivered to residents." },
  { id: "access", key: "5", en: "Access & benefits", zh: "通行福利", blurb: "Cards and points that let residents use services across the city." },
  { id: "supply", key: "6", en: "Space & supply", zh: "空間供給", blurb: "Physical space, green cover and food that land in neighborhoods." },
];

// from/to may list several nodes; every from × to pair is one edge. two = two-way.
export const flows = [
  { id: "F1", res: "staff", from: ["civil"], to: ["institute", "transport", "education", "lunch", "family", "card", "welfare", "sport", "trails", "forest", "youth", "diplomacy", "hakka"], text: "Easing civil servants' workload first frees capacity for every other policy." },
  { id: "F2", res: "staff", from: ["civil"], to: ["welfare"], text: "City hall pilots flexible hours and sets the example for family-friendly workplaces." },
  { id: "F19", res: "staff", from: ["hakka"], to: ["civil"], text: "Hakka-language skills earn credit in city hiring for counter and 1999 hotline roles." },

  { id: "F3", res: "data", from: ["institute"], to: ["welfare", "transport", "education"], text: "The institute backs long-range planning for social care, transport and schools." },
  { id: "F4", res: "data", from: ["education", "welfare", "police"], to: ["institute"], text: "School, social-services and police data feed a child-safety center." },
  { id: "F12", res: "data", from: ["civil"], to: ["youth", "education"], two: true, text: "AI support services shared with young people, schools and city staff." },

  { id: "F5", res: "knowhow", from: ["diplomacy"], to: ["transport", "forest"], text: "Overseas experience in transport, urban forests and housing comes home." },
  { id: "F6", res: "knowhow", from: ["transport", "education"], to: ["diplomacy"], two: true, text: "Safe-routes-to-school lessons traded with a sister city." },
  { id: "F15", res: "knowhow", from: ["diplomacy"], to: ["youth"], two: true, text: "Youth programs join an international city network to train citizen diplomats." },
  { id: "F17", res: "knowhow", from: ["hakka"], to: ["education"], text: "Taipei schools pair with Hakka-village schools for holiday visits." },
  { id: "F20", res: "knowhow", from: ["hakka"], to: ["diplomacy"], text: "Hakka culture gets a seat at the city's international forum." },

  { id: "F8", res: "care", from: ["sport"], to: ["welfare", "community"], text: "Neighborhood exercise programs keep older residents active and connected." },
  { id: "F10", res: "care", from: ["family"], to: ["education", "card"], two: true, text: "Parenting support, family education and shared learning move together." },
  { id: "F11", res: "care", from: ["welfare", "family"], to: ["civil", "education"], two: true, text: "Mental-health support reaches from home and school into city workplaces." },
  { id: "F16", res: "care", from: ["hakka"], to: ["welfare"], text: "Elder centers link into community care, with young and old learning together." },

  { id: "F9", res: "access", from: ["card"], to: ["welfare"], two: true, text: "The family card links with the senior card so grandparents and kids go out together." },
  { id: "F18", res: "access", from: ["hakka"], to: ["card", "trails"], text: "Hakka-language points on the city app lead residents into Hakka districts." },

  { id: "F7", res: "supply", from: ["transport"], to: ["sport", "trails"], two: true, text: "Sport stations connect commuting, exercise and hiking." },
  { id: "F13", res: "supply", from: ["forest"], to: ["sport"], two: true, text: "Micro-forests and sport spaces bring shade into neighborhoods." },
  { id: "F14", res: "supply", from: ["farm"], to: ["lunch", "education"], text: "Local farmers supply school lunches and food education." },
];
