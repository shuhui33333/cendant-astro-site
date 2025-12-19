// src/lib/contentful.ts
type CfLink = { sys: { type: "Link"; linkType: string; id: string } };

export type RealEstatePost = {
  id: string;
  title: string;
  slug: string;
  publishDate?: string;
  summary?: string;
  dealType?: string; // sale / rent / 出售 / 出租...
  category?: string; // apartment / 公寓 ...
  image?: string | null; // ✅ 只取第一张封面图 URL（你页面用这个最稳）
};

export type RealEstatePostDetail = RealEstatePost & {
  body?: any; // Rich text JSON
  bodyZh?: string;
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
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Contentful error ${res.status}\nURL: ${url}\nBody: ${text}`);
  }
  return JSON.parse(text);
}

function toAssetUrl(u?: string) {
  if (!u) return null;
  return u.startsWith("//") ? `https:${u}` : u;
}

function pickCategory(fields: any): string | undefined {
  // ✅ 兼容你可能写成 Catagory 的情况
  return fields?.category ?? fields?.catagory;
}

/** ✅ 从 includes.Asset 里，把 entry.fields.image (links) 解析成真实图片 URL 列表 */
function resolveImageUrls(entry: any, includes: any): string[] {
  const links: CfLink[] = entry?.fields?.image ?? []; // Image (many files)
  if (!Array.isArray(links) || !includes?.Asset) return [];

  const idToUrl = new Map<string, string>();
  for (const a of includes.Asset) {
    const url = toAssetUrl(a?.fields?.file?.url);
    if (a?.sys?.id && url) idToUrl.set(a.sys.id, url);
  }

  return links
    .map((l) => idToUrl.get(l?.sys?.id))
    .filter(Boolean) as string[];
}

/** ✅ 把 Contentful entry 转成你页面需要的结构 */
function toPost(item: any, includes: any): RealEstatePost {
  const fields = item?.fields ?? {};
  const imgs = resolveImageUrls(item, includes);
  return {
    id: item?.sys?.id ?? "",
    title: fields?.title ?? "Untitled",
    slug: fields?.slug ?? "",
    publishDate: fields?.publishDate,
    summary: fields?.summary,
    dealType: fields?.dealType,
    category: pickCategory(fields),
    image: imgs[0] ?? null, // ✅ 封面图取第一张
  };
}

export async function getRealEstatePosts(limit = 20) {
  try {
    const data = await cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&order=-fields.publishDate&limit=${limit}&include=2`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((it: any) => toPost(it, data?.includes));
  } catch (err) {
    console.error("[Contentful] getRealEstatePosts failed:", err);
    return []; // ✅ 不让构建失败
  }
}

export async function getRealEstatePostBySlug(slug: string) {
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
    bodyZh: fields?.bodyZh,
  } as RealEstatePostDetail;
}

export async function getAllRealEstateSlugs() {
  const data = await cfFetch(
    `/entries?content_type=${CONTENT_TYPE}&select=fields.slug&limit=1000`
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((it: any) => it?.fields?.slug).filter(Boolean);
}
