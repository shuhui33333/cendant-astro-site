export const RE_CATEGORIES = [
  { slug: "villa", zh: "别墅", en: "VILLA" },
  { slug: "apartment", zh: "公寓", en: "APARTMENT" },
  { slug: "second-hand", zh: "二手房", en: "SECOND-HAND" },
  { slug: "commercial", zh: "商业办公楼", en: "COMMERCIAL" },
  { slug: "land", zh: "土地开发", en: "LAND DEVELOPMENT" },
] as const;

export function catBySlug(slug: string) {
  return RE_CATEGORIES.find((c) => c.slug === slug);
}