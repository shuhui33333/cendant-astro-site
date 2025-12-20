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
  imageUrls: string[]; // ✅ 多图
  image: string | null; // ✅ 兼容旧代码：封面=第一张
};

export type RealEstatePostDetail = RealEstatePost & {
  body?: any; // Rich text JSON
};

/**
 * ✅ Cloudflare Pages + Astro SSR 最稳 env 读取方式：
 * - 先读 import.meta.env（构建/运行时可能存在）
 * - 再兜底 process.env（某些本地/adapter 情况）
 */
function getEnv(name: string): string {
  const v =
    (import.meta as any)?.env?.[name] ??
    (globalThis as any)?.process?.env?.[name] ??
    "";
  return typeof v === "string" ? v : String(v || "");
}

const SPACE = getEnv("CONTENTFUL_SPACE_ID");
const TOKEN = getEnv("CONTENTFUL_DELIVERY_TOKEN");
const ENV = getEnv("CONTENTFUL_ENVIRONMENT") || "master";
const CONTENT_TYPE = "realEstatePost";

// ✅ 不要在模块加载阶段把整站直接 throw 死（会导致首页 500）
// 改成：在真正请求 Contentful 时再报错，并且保持错误信息可追踪
function assertEnv() {
  if (!SPACE) throw new Error("Missing env: CONTENTFUL_SPACE_ID");
  if (!TOKEN) throw new Error("Missing env: CONTENTFUL_DELIVERY_TOKEN");
}

function toAssetUrl(u?: string) {
  if (!u) return "";
  return u.startsWith("//") ? `https:${u}` : u;
}

function pickCategory(fields: any): string | undefined {
  // ✅ 兼容你可能拼成 Catagory
  return fields?.category ?? fields?.catagory;
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

async function cfFetch(path: string) {
  assertEnv();

  const base = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;
  const url = `${base}${path}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  const text = await res.text();
  if (!res.ok) {
    // ✅ 帮你把 Contentful 返回体带上，方便排查 Token/权限/模型
    throw new Error(`Contentful error ${res.status}\nURL: ${url}\nBody: ${text}`);
  }

  // Contentful 正常会返回 JSON
  return JSON.parse(text);
}

export async function getRealEstatePosts(limit = 20) {
  try {
    const data = await cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&order=-fields.publishDate&limit=${limit}&include=2`
    );

    const items = Array.isArray(data?.items) ? data.items : [];
    const includes = data?.includes;

    // ✅ 统一用 toPost（避免你文件里出现两套 resolveImageUrls，容易出错）
    return items.map((it: any) => toPost(it, includes));
  } catch (err) {
    console.error("[Contentful] getRealEstatePosts failed:", err);
    return [];
  }
}

export async function getRealEstatePostBySlug(
  slug: string
): Promise<RealEstatePostDetail | null> {
  try {
    const data = await cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&fields.slug=${encodeURIComponent(
        slug
      )}&limit=1&include=2`
    );

    const it = data?.items?.[0];
    if (!it) return null;

    const fields = it.fields ?? {};
    const base = toPost(it, data?.includes);

    return {
      ...base,
      body: fields?.body,
    };
  } catch (err) {
    console.error("[Contentful] getRealEstatePostBySlug failed:", err);
    return null;
  }
}

export async function getAllRealEstateSlugs(): Promise<string[]> {
  try {
    const data = await cfFetch(
      `/entries?content_type=${CONTENT_TYPE}&select=fields.slug&limit=1000`
    );
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((it: any) => it?.fields?.slug).filter(Boolean);
  } catch (err) {
    console.error("[Contentful] getAllRealEstateSlugs failed:", err);
    return [];
  }
}