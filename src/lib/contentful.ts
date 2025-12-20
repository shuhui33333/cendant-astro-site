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
  imageUrls: string[];
  image: string | null;
};

export type RealEstatePostDetail = RealEstatePost & {
  body?: any;
};

type CfEnv = {
  CONTENTFUL_SPACE_ID?: string;
  CONTENTFUL_DELIVERY_TOKEN?: string;
  CONTENTFUL_ENVIRONMENT?: string; // optional
};

const CONTENT_TYPE = "realEstatePost";

function toAssetUrl(u?: string) {
  if (!u) return "";
  return u.startsWith("//") ? `https:${u}` : u;
}

function resolveImageUrls(entry: any, includes: any): string[] {
  const field = entry?.fields?.image;
  if (!field) return [];

  // 已展开
  if (Array.isArray(field) && field?.[0]?.fields?.file?.url) {
    return field
      .map((a: any) => toAssetUrl(a?.fields?.file?.url))
      .filter(Boolean);
  }

  // Link -> includes
  const links: CfLink[] = Array.isArray(field) ? field : [field];
  const assets = includes?.Asset ?? [];
  if (!Array.isArray(assets) || assets.length === 0) return [];

  const idToUrl = new Map<string, string>();
  for (const a of assets) {
    const id = a?.sys?.id;
    const url = toAssetUrl(a?.fields?.file?.url);
    if (id && url) idToUrl.set(id, url);
  }

  return links.map((l: any) => idToUrl.get(l?.sys?.id)).filter(Boolean) as string[];
}

function pickCategory(fields: any): string | undefined {
  return fields?.category ?? fields?.catagory;
}

function makeClient(env: CfEnv) {
  const SPACE = env.CONTENTFUL_SPACE_ID;
  const TOKEN = env.CONTENTFUL_DELIVERY_TOKEN;
  const ENV = env.CONTENTFUL_ENVIRONMENT ?? "master";

  if (!SPACE || !TOKEN) {
    // 不要 throw（否则整站 500），改成在调用处处理
    return null;
  }

  const BASE = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;

  async function cfFetch(path: string) {
    const url = `${BASE}${path}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const text = await res.text();
    if (!res.ok) throw new Error(`Contentful error ${res.status}\nURL: ${url}\nBody: ${text}`);
    return JSON.parse(text);
  }

  return { cfFetch };
}

export async function getRealEstatePosts(env: CfEnv, limit = 20) {
  const client = makeClient(env);
  if (!client) {
    console.error("[Contentful] Missing env: CONTENTFUL_SPACE_ID or CONTENTFUL_DELIVERY_TOKEN");
    return [];
  }

  try {
    const data = await client.cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&order=-fields.publishDate&limit=${limit}&include=2`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    const includes = data?.includes;

    return items.map((it: any) => {
      const fields = it?.fields ?? {};
      const imageUrls = resolveImageUrls(it, includes);
      return {
        id: it?.sys?.id ?? "",
        title: fields?.title ?? "",
        slug: fields?.slug ?? "",
        publishDate: fields?.publishDate ?? "",
        category: pickCategory(fields) ?? "",
        dealType: fields?.dealType ?? "",
        summary: fields?.summary ?? "",
        imageUrls,
        image: imageUrls[0] ?? null,
      };
    });
  } catch (err) {
    console.error("[Contentful] getRealEstatePosts failed:", err);
    return [];
  }
}

export async function getRealEstatePostBySlug(env: CfEnv, slug: string): Promise<RealEstatePostDetail | null> {
  const client = makeClient(env);
  if (!client) return null;

  const data = await client.cfFetch(
    `/entries?content_type=${CONTENT_TYPE}&fields.slug=${encodeURIComponent(slug)}&limit=1&include=2`
  );

  const it = data?.items?.[0];
  if (!it) return null;

  const fields = it.fields ?? {};
  const imageUrls = resolveImageUrls(it, data?.includes);

  return {
    id: it?.sys?.id ?? "",
    title: fields?.title ?? "Untitled",
    slug: fields?.slug ?? "",
    publishDate: fields?.publishDate,
    summary: fields?.summary,
    dealType: fields?.dealType,
    category: pickCategory(fields),
    imageUrls,
    image: imageUrls[0] ?? null,
    body: fields?.body,
  };
}