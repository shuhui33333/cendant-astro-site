// src/lib/realEstateTaxonomy.ts

/** 网站要显示的“分类页”清单（即使暂时没有房源也要生成页面） */
export const SALE_CATEGORY_SLUGS = [
  "apartment",
  "second-hand",
  "townhouse",
  "land-villa",
  "commercial",
  "land",
  "farm",
  "hotel",
] as const;

export const RENT_CATEGORY_SLUGS = [
  "apartment",
  "townhouse",
  "land-villa",
  "commercial",
] as const;

export const DEAL_TYPES = ["sale", "rent"] as const;

export const CATEGORY_ZH_MAP: Record<string, string> = {
  apartment: "公寓",
  "second-hand": "二手房",
  townhouse: "联排别墅",
  "land-villa": "土地别墅",
  commercial: "商业办公",
  land: "土地开发",
  farm: "农场",
  hotel: "酒店",
};

// ✅ 归一化：中文/英文/混写/带符号都能匹配
export function normalizeKey(s: any): string {
  const raw = String(s ?? "").trim();
  const t = raw.toLowerCase();

  // --- dealType：只要“包含”关键词就认 ---
  if (/(sale|sell|selling|出售|售卖|售房|卖房)/i.test(raw)) return "sale";
  if (/(rent|rental|lease|出租|租赁|租房)/i.test(raw)) return "rent";

  // --- category：只要“包含”关键词就认 ---
  const catRules: Array<[RegExp, string]> = [
    [/公寓|apartment/i, "apartment"],
    [/二手房|second[-\s_]?hand/i, "second-hand"],
    [/联排|联排别墅|townhouse/i, "townhouse"],
    [/土地别墅|land[-\s_]?villa/i, "land-villa"],
    [/商业|办公|commercial/i, "commercial"],
    [/土地开发|土地|land/i, "land"],
    [/农场|farm/i, "farm"],
    [/酒店|hotel/i, "hotel"],
  ];
  for (const [re, slug] of catRules) {
    if (re.test(raw)) return slug;
  }

  // --- 兜底：转 slug（保留中文，但最后仍会变成 slug） ---
  return t
    .replace(/&/g, "and")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-");
} 