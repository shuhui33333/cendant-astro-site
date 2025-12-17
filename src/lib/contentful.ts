// src/lib/contentful.ts
type CfSys = { id: string };
type CfLink = { sys: { type: "Link"; linkType: string; id: string } };

export type RealEstatePost = {
  id: string;
  title: string;
  slug: string;
  publishDate?: string;
  summary?: string;
  dealType?: string; // sale / rent
  category?: string; // apartment / townhouse ...
  imageUrls: string[];
};

export type RealEstatePostDetail = RealEstatePost & {
  body?: any; // Rich text JSON
  bodyZh?: string; // 如果你有 Body (ZH) 字段
};

const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;
const ENV = import.meta.env.CONTENTFUL_ENVIRONMENT ?? "master";

// ✅ 固定 content type，避免被环境变量污染成 DOESNOTEXIST
const CONTENT_TYPE = "realEstatePost";

if (!SPACE) throw new Error("Missing env: CONTENTFUL_SPACE_ID");
if (!TOKEN) throw new Error("Missing env: CONTENTFUL_DELIVERY_TOKEN");

const BASE = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;

async function cfFetch(path: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  const text = await res.text();
  if (!res.ok) {
    // 把 URL 和返回内容一起抛出来，方便你定位
    throw new Error(`Contentful error ${res.status}\nURL: ${url}\nBody: ${text}`);
  }
  return JSON.parse(text);
}

function toAssetUrl(u?: string) {
  if (!u) return null;
  return u.startsWith("//") ? `https:${u}` : u;
}

function resolveAssetsFromIncludes(entry: any, includes: any): string[] {
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

function pickCategory(fields: any): string | undefined {
  // 兼容你 Contentful 里可能叫 Catagory（拼写）
  return fields?.category ?? fields?.catagory;
}

function toPost(item: any, includes: any): RealEstatePost {
  const fields = item?.fields ?? {};
  return {
    id: item?.sys?.id ?? "",
    title: fields?.title ?? "Untitled",
    slug: fields?.slug ?? "",
    publishDate: fields?.publishDate,
    summary: fields?.summary,
    dealType: fields?.dealType,
    category: pickCategory(fields),
    imageUrls: resolveAssetsFromIncludes(item, includes),
  };
}


export async function getRealEstatePosts(limit = 20) {
  try {
    const data = await cfFetch(
      `/entries?content_type=realEstatePost&order=-fields.publishDate&limit=${limit}&include=2`
    );

    return (data.items ?? []).map((it: any) => ({
      title: it.fields?.title ?? "",
      slug: it.fields?.slug ?? "",
      publishDate: it.fields?.publishDate ?? "",
      category: it.fields?.category ?? "",
      dealType: it.fields?.dealType ?? "",
      summary: it.fields?.summary ?? "",
      image: it.fields?.image?.[0]?.fields?.file?.url
        ? `https:${it.fields.image[0].fields.file.url}`
        : null,
    }));
  } catch (err) {
    console.error("[Contentful] getRealEstatePosts failed:", err);
    return []; // ✅ 兜底：不让构建失败
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
    body: fields?.body, // Rich text
    bodyZh: fields?.["bodyZh"] ?? fields?.["bodyZh"] ?? fields?.["body (zh)"] ?? fields?.["bodyZh"], // 兜底（你可删）
  } as RealEstatePostDetail;
}

export async function getAllRealEstateSlugs() {
  const data = await cfFetch(
    `/entries?content_type=${CONTENT_TYPE}&select=fields.slug&limit=1000`
  );
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((it: any) => it?.fields?.slug).filter(Boolean);
}
