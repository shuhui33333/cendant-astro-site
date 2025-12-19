// src/lib/contentful.ts

type CfLink = { sys: { type: "Link"; linkType: "Asset"; id: string } };

export type RealEstatePost = {
  id: string;
  title: string;
  slug: string;
  publishDate?: string;
  summary?: string;
  dealType?: string;
  category?: string;
  imageUrls: string[];      // ✅ 多图
  image: string | null;     // ✅ 兼容旧代码：封面=第一张
};

export type RealEstatePostDetail = RealEstatePost & {
  body?: any; // Rich text JSON
};

const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;
const ENV = import.meta.env.CONTENTFUL_ENVIRONMENT ?? "master";
const CONTENT_TYPE = "realEstatePost";

if (!SPACE) throw new Error("Missing env: CONTENTFUL_SPACE_ID");
if (!TOKEN) throw new Error("Missing env: CONTENTFUL_DELIVERY_TOKEN");

const BASE = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;

async function cfFetch(path: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const text = await res.text();
  if (!res.ok) throw new Error(`Contentful error ${res.status}\nURL: ${url}\nBody: ${text}`);
  return JSON.parse(text);
}

function toAssetUrl(u?: string) {
  if (!u) return "";
  return u.startsWith("//") ? `https:${u}` : u;
}

/**
 * ✅ 从 entry.fields.image (many files) 里取出所有图片 URL
 * 兼容 2 种情况：
 * 1) REST 常见：fields.image = [ {sys:{id}} ... ] 需要从 includes.Asset 映射
 * 2) 已展开：fields.image = [ {fields:{file:{url}}} ... ]
 */
function resolveImageUrls(entry: any, includes: any): string[] {
  const field = entry?.fields?.image;

  if (!field) return [];

  // 情况2：已展开 asset
  if (Array.isArray(field) && field?.[0]?.fields?.file?.url) {
    return field
      .map((a: any) => toAssetUrl(a?.fields?.file?.url))
      .filter(Boolean);
  }

  // 情况1：Link -> includes.Asset
  const links: CfLink[] = Array.isArray(field) ? field : [field];
  const assets = includes?.Asset ?? [];
  if (!Array.isArray(assets) || assets.length === 0) return [];

  const idToUrl = new Map<string, string>();
  for (const a of assets) {
    const id = a?.sys?.id;
    const url = toAssetUrl(a?.fields?.file?.url);
    if (id && url) idToUrl.set(id, url);
  }

  return links
    .map((l: any) => idToUrl.get(l?.sys?.id))
    .filter(Boolean) as string[];
}

function pickCategory(fields: any): string | undefined {
  // ✅ 兼容你可能拼成 Catagory
  return fields?.category ?? fields?.catagory;
}

function toPost(item: any, includes: any): RealEstatePost {
  const fields = item?.fields ?? {};
  const imageUrls = resolveImageUrls(item, includes);
  return {
    id: item?.sys?.id ?? "",
    title: fields?.title ?? "Untitled",
    slug: fields?.slug ?? "",
    publishDate: fields?.publishDate,
    summary: fields?.summary,
    dealType: fields?.dealType,
    category: pickCategory(fields),
    imageUrls,
    image: imageUrls[0] ?? null,
  };
}

export async function getRealEstatePosts(limit = 20) {
  try {
    const data = await cfFetch(
      `/entries?content_type=realEstatePost&order=-fields.publishDate&limit=${limit}&include=2`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    const includes = data?.includes;

    // 把 Asset id -> url 做成字典
    const assetMap = new Map<string, string>();
    for (const a of includes?.Asset ?? []) {
      const u = a?.fields?.file?.url;
      const url = u ? (u.startsWith("//") ? `https:${u}` : u) : "";
      if (a?.sys?.id && url) assetMap.set(a.sys.id, url);
    }

    function resolveImageUrls(entry: any): string[] {
      const links = entry?.fields?.image; // many files
      if (!Array.isArray(links)) return [];
      return links
        .map((l) => assetMap.get(l?.sys?.id))
        .filter(Boolean) as string[];
    }

    return items.map((it: any) => {
      const imageUrls = resolveImageUrls(it);

      return {
        title: it.fields?.title ?? "",
        slug: it.fields?.slug ?? "",
        publishDate: it.fields?.publishDate ?? "",
        category: it.fields?.category ?? "",
        dealType: it.fields?.dealType ?? "",
        summary: it.fields?.summary ?? "",
        imageUrls,
        image: imageUrls[0] ?? null, // ✅ 封面图：第一张真实图
      };
    });
  } catch (err) {
    console.error("[Contentful] getRealEstatePosts failed:", err);
    return [];
  }
}

export async function getRealEstatePostBySlug(slug: string): Promise<RealEstatePostDetail | null> {
  const data = await cfFetch(
    `/entries?content_type=${CONTENT_TYPE}&fields.slug=${encodeURIComponent(slug)}&limit=1&include=2`
  );

  const it = data?.items?.[0];
  if (!it) return null;

  const fields = it.fields ?? {};
  const base = toPost(it, data?.includes);

  return {
    ...base,
    body: fields?.body,
  };
}

export async function getAllRealEstateSlugs(): Promise<string[]> {
  const data = await cfFetch(`/entries?content_type=${CONTENT_TYPE}&select=fields.slug&limit=1000`);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((it: any) => it?.fields?.slug).filter(Boolean);
}
