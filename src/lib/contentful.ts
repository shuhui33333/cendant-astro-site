// src/lib/contentful.ts
type CfLink = { sys: { id: string } };

export type RealEstatePost = {
  id: string;
  title: string;
  slug: string;
  publishDate?: string;
  summary?: string;
  dealType?: string;
  category?: string;
  imageUrls: string[]; // ✅ 多图
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
  if (u.startsWith("//")) return `https:${u}`;
  return u;
}

function pickCategory(fields: any): string {
  return fields?.category ?? fields?.catagory ?? "";
}

/** ✅ 把 entry.fields.image (Link数组) 解析成图片 URL 数组 */
function resolveImageUrls(entry: any, includes: any): string[] {
  const links: CfLink[] = entry?.fields?.image ?? [];
  if (!Array.isArray(links) || !includes?.Asset) return [];

  const idToUrl = new Map<string, string>();
  for (const a of includes.Asset) {
    const url = toAssetUrl(a?.fields?.file?.url);
    if (a?.sys?.id && url) idToUrl.set(a.sys.id, url);
  }

  return links.map((l) => idToUrl.get(l?.sys?.id) || "").filter(Boolean);
}

function toPost(item: any, includes: any): RealEstatePost {
  const fields = item?.fields ?? {};
  return {
    id: item?.sys?.id ?? "",
    title: fields?.title ?? "",
    slug: fields?.slug ?? "",
    publishDate: fields?.publishDate ?? "",
    summary: fields?.summary ?? "",
    dealType: fields?.dealType ?? "",
    category: pickCategory(fields),
    imageUrls: resolveImageUrls(item, includes),
  };
}

export async function getRealEstatePosts(limit = 50): Promise<RealEstatePost[]> {
  try {
    const data = await cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&order=-fields.publishDate&limit=${limit}&include=2`
    );
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((it: any) => toPost(it, data?.includes));
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
