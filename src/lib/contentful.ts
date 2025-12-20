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

export type CfEnv = {
  CONTENTFUL_SPACE_ID?: string;
  CONTENTFUL_DELIVERY_TOKEN?: string;
  CONTENTFUL_ENVIRONMENT?: string;
};

const CONTENT_TYPE = "realEstatePost";

/* ------------------ utils ------------------ */

function toAssetUrl(u?: string) {
  if (!u) return "";
  return u.startsWith("//") ? `https:${u}` : u;
}

function pickCategory(fields: any): string | undefined {
  return fields?.category ?? fields?.catagory;
}

/**
 * 支持：
 * 1) fields.image = [Asset 已展开]
 * 2) fields.image = [Link] + includes.Asset
 */
function resolveImageUrls(entry: any, includes: any): string[] {
  const field = entry?.fields?.image;
  if (!field) return [];

  // 已展开
  if (Array.isArray(field) && field?.[0]?.fields?.file?.url) {
    return field.map((a: any) => toAssetUrl(a?.fields?.file?.url)).filter(Boolean);
  }

  // Link → includes.Asset
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

/* ------------------ env / client ------------------ */

/** ✅ 允许不传 env：默认从 import.meta.env 读（build 期可用） */
function getDefaultEnv(): CfEnv {
  const e = (import.meta as any)?.env ?? {};
  return {
    CONTENTFUL_SPACE_ID: e.CONTENTFUL_SPACE_ID,
    CONTENTFUL_DELIVERY_TOKEN: e.CONTENTFUL_DELIVERY_TOKEN,
    CONTENTFUL_ENVIRONMENT: e.CONTENTFUL_ENVIRONMENT ?? "master",
  };
}

/** ✅ 合并：传入 env 优先（运行期），否则用 import.meta.env（构建期） */
function mergeEnv(env?: CfEnv): CfEnv {
  const base = getDefaultEnv();
  return { ...base, ...(env ?? {}) };
}

function makeClient(env?: CfEnv) {
  const merged = mergeEnv(env);
  const SPACE = merged.CONTENTFUL_SPACE_ID;
  const TOKEN = merged.CONTENTFUL_DELIVERY_TOKEN;
  const ENV = merged.CONTENTFUL_ENVIRONMENT ?? "master";

  if (!SPACE || !TOKEN) {
    console.error("[Contentful] Missing env:", {
      hasSpace: Boolean(SPACE),
      hasToken: Boolean(TOKEN),
      env: ENV,
    });
    return null;
  }

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

  return { cfFetch };
}

/* ------------------ APIs ------------------ */

/** ✅ 兼容旧调用：getRealEstatePosts(9) 也能用 */
export async function getRealEstatePosts(arg1: any = 20, arg2?: number): Promise<RealEstatePost[]> {
  const env: CfEnv | undefined = typeof arg1 === "object" ? arg1 : undefined;
  const limit: number = typeof arg1 === "number" ? arg1 : (arg2 ?? 20);

  const client = makeClient(env);
  if (!client) return [];

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
        summary: fields?.summary ?? "",
        dealType: fields?.dealType ?? "",
        category: pickCategory(fields) ?? "",
        imageUrls,
        image: imageUrls[0] ?? null,
      };
    });
  } catch (err) {
    console.error("[Contentful] getRealEstatePosts failed:", err);
    return [];
  }
}

/** ✅ 兼容旧调用：getRealEstatePostBySlug(slug) 也能用 */
export async function getRealEstatePostBySlug(arg1: any, arg2?: string): Promise<RealEstatePostDetail | null> {
  const env: CfEnv | undefined = typeof arg1 === "object" ? arg1 : undefined;
  const slug: string = typeof arg1 === "string" ? arg1 : (arg2 ?? "");

  if (!slug) return null;

  const client = makeClient(env);
  if (!client) return null;

  try {
    const data = await client.cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&fields.slug=${encodeURIComponent(slug)}&limit=1&include=2`
    );

    const it = data?.items?.[0];
    if (!it) return null;

    const fields = it?.fields ?? {};
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
  } catch (err) {
    console.error("[Contentful] getRealEstatePostBySlug failed:", err);
    return null;
  }
}

/** ✅ 兼容旧调用：getAllRealEstateSlugs() 也能用 */
export async function getAllRealEstateSlugs(env?: CfEnv): Promise<string[]> {
  const client = makeClient(env);
  if (!client) return [];

  try {
    const data = await client.cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&select=fields.slug&limit=1000`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((it: any) => it?.fields?.slug).filter(Boolean);
  } catch (err) {
    console.error("[Contentful] getAllRealEstateSlugs failed:", err);
    return [];
  }
}

/** ✅ 旧别名（如果哪里用过） */
export const getAllSlugs = getAllRealEstateSlugs;

export async function getRealEstatePostsByFilter(
  env: CfEnv,
  opts: { dealType?: string; category?: string; limit?: number }
): Promise<RealEstatePost[]> {
  const client = makeClient(env);
  if (!client) {
    console.error("[Contentful] Missing env vars");
    return [];
  }

  const limit = opts.limit ?? 50;

  // 这里假设字段是 fields.dealType / fields.category
  const params = new URLSearchParams();
  params.set("content_type", CONTENT_TYPE);
  params.set("order", "-fields.publishDate");
  params.set("limit", String(limit));
  params.set("include", "2");

  if (opts.dealType) params.set("fields.dealType", opts.dealType);
  if (opts.category) params.set("fields.category", opts.category);

  try {
    const data = await client.cfFetch(`/entries?${params.toString()}`);
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
        summary: fields?.summary ?? "",
        dealType: fields?.dealType ?? "",
        category: pickCategory(fields) ?? "",
        imageUrls,
        image: imageUrls[0] ?? null,
      };
    });
  } catch (err) {
    console.error("[Contentful] getRealEstatePostsByFilter failed:", err);
    return [];
  }
}
