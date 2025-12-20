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
  CONTENTFUL_ENVIRONMENT?: string;
};

const CONTENT_TYPE = "realEstatePost";

/* ------------------ env helper ------------------ */
// 兼容：
// - build-time: import.meta.env
// - runtime (Cloudflare Pages SSR): 你可以传 locals.runtime.env
function readEnv(runtimeEnv?: CfEnv): Required<Pick<CfEnv, "CONTENTFUL_SPACE_ID" | "CONTENTFUL_DELIVERY_TOKEN">> &
  Pick<CfEnv, "CONTENTFUL_ENVIRONMENT"> {
  const buildEnv = import.meta.env as any;

  const SPACE = runtimeEnv?.CONTENTFUL_SPACE_ID ?? buildEnv.CONTENTFUL_SPACE_ID;
  const TOKEN = runtimeEnv?.CONTENTFUL_DELIVERY_TOKEN ?? buildEnv.CONTENTFUL_DELIVERY_TOKEN;
  const ENV = runtimeEnv?.CONTENTFUL_ENVIRONMENT ?? buildEnv.CONTENTFUL_ENVIRONMENT ?? "master";

  return {
    CONTENTFUL_SPACE_ID: SPACE,
    CONTENTFUL_DELIVERY_TOKEN: TOKEN,
    CONTENTFUL_ENVIRONMENT: ENV,
  } as any;
}

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
 * 1) fields.image = [Asset]
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

/* ------------------ client ------------------ */
function makeClient(runtimeEnv?: CfEnv) {
  const { CONTENTFUL_SPACE_ID: SPACE, CONTENTFUL_DELIVERY_TOKEN: TOKEN, CONTENTFUL_ENVIRONMENT: ENV } =
    readEnv(runtimeEnv);

  if (!SPACE || !TOKEN) return null;

  const BASE = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;

  async function cfFetch(path: string) {
    const url = `${BASE}${path}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`Contentful error ${res.status}\nURL: ${url}\nBody: ${text}`);
    }
    return JSON.parse(text);
  }

  return { cfFetch };
}

/* ------------------ APIs ------------------ */

// ✅ env 可选：不传也能用（兼容旧代码）
export async function getRealEstatePosts(runtimeEnv?: CfEnv, limit = 20): Promise<RealEstatePost[]> {
  const client = makeClient(runtimeEnv);
  if (!client) {
    console.error("[Contentful] Missing env vars: CONTENTFUL_SPACE_ID / CONTENTFUL_DELIVERY_TOKEN");
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

export async function getRealEstatePostBySlug(
  slug: string,
  runtimeEnv?: CfEnv
): Promise<RealEstatePostDetail | null> {
  const client = makeClient(runtimeEnv);
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

export async function getAllRealEstateSlugs(runtimeEnv?: CfEnv): Promise<string[]> {
  const client = makeClient(runtimeEnv);
  if (!client) return [];

  try {
    const data = await client.cfFetch(`/entries?content_type=${CONTENT_TYPE}&select=fields.slug&limit=1000`);
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((it: any) => it?.fields?.slug).filter(Boolean);
  } catch (err) {
    console.error("[Contentful] getAllRealEstateSlugs failed:", err);
    return [];
  }
}

// ✅ 兼容旧引用名
export const getAllSlugs = getAllRealEstateSlugs;