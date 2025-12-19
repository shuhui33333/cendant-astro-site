// src/lib/realEstateTaxonomy.ts

/** 你网站要显示的“分类页”清单（即使暂时没有房源也要生成页面） */
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

/** ✅ 归一化：中文/英文/卖房/SELL/出租…全部转成标准 slug */
export function normalizeKey(s: any): string {
  const t = String(s ?? "").trim().toLowerCase();

  const slug = t
    .replace(/&/g, "and")
    .replace(/[\s_]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "")
    .replace(/-+/g, "-");

  // dealType
  if (
    slug === "sale" ||
    slug === "sell" ||
    slug === "selling" ||
    slug === "出售" ||
    slug === "售卖" ||
    slug === "售房" ||
    slug === "卖房"
  ) return "sale";

  if (
    slug === "rent" ||
    slug === "rental" ||
    slug === "lease" ||
    slug === "出租" ||
    slug === "租赁" ||
    slug === "租房"
  ) return "rent";

  // category 中文 -> slug
  const catCnToSlug: Record<string, string> = {
    公寓: "apartment",
    二手房: "second-hand",
    联排别墅: "townhouse",
    土地别墅: "land-villa",
    商业办公: "commercial",
    商业办公楼: "commercial",
    商业办公室: "commercial",
    土地开发: "land",
    土地: "land",
    农场: "farm",
    酒店: "hotel",
  };

  if (catCnToSlug[slug]) return catCnToSlug[slug];

  return slug;
}