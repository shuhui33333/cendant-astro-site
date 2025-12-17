// src/lib/contentful.ts
// ✅ 适配：Astro + Cloudflare Pages + Contentful (Delivery API)
// ✅ 支持：按 sale/rent + 分类过滤；列表页/详情页/slug 列表
// ✅ 兼容：字段名不一致（dealType/type, category/tag）

export type DealType = "sale" | "rent";

export type RealEstatePost = {
  title: string;
  slug: string;
  summary?: string;
  publishDate?: string;
  dealType?: DealType;
  category?: string;
  coverImageUrl?: string;
};

export type RealEstatePostDetail = RealEstatePost & {
  body?: any; // Rich Text 或 Markdown 字符串（取决于你 Contentful 字段类型）
};

const SPACE = import.meta.env.CONTENTFUL_SPACE_ID as string | undefined;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN as string | undefined;

// 可选：如果你在 Contentful 用了 Environment（默认 master）
const ENV = (import.meta.env.CONTENTFUL_ENVIRONMENT as string | undefined) || "master";

// 可选：预览（Draft）模式用
const PREVIEW_TOKEN = import.meta.env.CONTENTFUL_PREVIEW_TOKEN as string | undefined;
const USE_PREVIEW = (import.meta.env.CONTENTFUL_USE_PREVIEW as string | undefined) === "true";

// 你的内容模型 ID（Content Type ID）
const REAL_ESTATE_CT = (import.meta.env.CONTENTFUL_REAL_ESTATE_CT as string | undefined) || "realEstatePost";

// Delivery API / Preview API base
const BASE = USE_PREVIEW
  ? `https://preview.contentful.com/spaces/${SPACE}/environments/${ENV}`
  : `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;

function ensureEnv() {
  if (!SPACE) throw new Error("Missing env: CONTENTFUL_SPACE_ID");
  if (!TOKEN && !(USE_PREVIEW && PREVIEW_TOKEN)) {
    throw new Error("Missing env: CONTENTFUL_DELIVERY_TOKEN (or CONTENTFUL_PREVIEW_TOKEN when preview)");
  }
}

function getAuthToken() {
  return USE_PREVIEW ? PREVIEW_TOKEN! : TOKEN!;
}

async function cfFetch(path: string) {
  ensureEnv();

  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Contentful error ${res.status}: ${text || url}`);
  }
  return res.json();
}

// 处理 Asset（封面图）URL
function pickCoverUrl(fields: any): string | undefined {
  // 常见字段名：cover / coverImage / image
  const asset = fields?.cover ?? fields?.coverImage ?? fields?.image;
  const fileUrl = asset?.fields?.file?.url;
  if (!fileUrl) return undefined;
  return fileUrl.startsWith("//") ? `https:${fileUrl}` : fileUrl;
}

// 兼容字段名：dealType/type + category/tag
function normalizePost(it: any): RealEstatePostDetail {
  const f = it?.fields || {};

  const title = f.title ?? "";
  const slug = f.slug ?? "";
  const summary = f.summary ?? f.excerpt ?? "";
  const publishDate = f.publishDate ?? f.date ?? "";

  // 兼容：dealType 或 type
  const dealType = (f.dealType ?? f.type ?? "") as DealType | "";

  // 兼容：category 或 tag
  const category = (f.category ?? f.tag ?? "") as string;

  // body 可能是 RichText，也可能是 markdown string
  const body = f.body ?? f.content ?? undefined;

  return {
    title,
    slug,
    summary,
    publishDate,
    dealType: dealType === "sale" || dealType === "rent" ? dealType : undefined,
    category: category || undefined,
    coverImageUrl: pickCoverUrl(f),
    body,
  };
}

type ListOptions = {
  limit?: number;
  skip?: number;

  // 过滤
  dealType?: DealType;
  category?: string;

  // 排序（默认按 publishDate 倒序）
  order?: string; // e.g. "-fields.publishDate"
};

/**
 * ✅ 获取房产资讯列表（可按 sale/rent + category 过滤）
 */
export async function getRealEstatePosts(options: ListOptions = {}) {
  const {
    limit = 20,
    skip = 0,
    dealType,
    category,
    order = "-fields.publishDate",
  } = options;

  // Contentful Query 参数
  // 注意：Contentful 字段过滤要用 fields.xxx
  const params: Record<string, string> = {
    content_type: REAL_ESTATE_CT,
    order,
    limit: String(limit),
    skip: String(skip),
    include: "1",
  };

  // 兼容：dealType 字段名可能叫 fields.dealType 或 fields.type
  // 我们同时发两个过滤：如果其中一个字段不存在，Contentful 会报 InvalidQuery
  // 所以这里采用“先尝试 dealType，再 fallback 到 type”的策略
  const query1 = { ...params } as Record<string, string>;
  const query2 = { ...params } as Record<string, string>;

  if (dealType) {
    query1["fields.dealType"] = dealType;
    query2["fields.type"] = dealType;
  }
  if (category) {
    query1["fields.category"] = category;
    query2["fields.tag"] = category;
  }

  const qs1 = "?" + new URLSearchParams(query1).toString();
  const qs2 = "?" + new URLSearchParams(query2).toString();

  let data: any;
  try {
    data = await cfFetch(`/entries${qs1}`);
  } catch (e1: any) {
    // fallback 到 type/tag
    data = await cfFetch(`/entries${qs2}`);
  }

  const items = (data?.items || []).map(normalizePost);

  // 只返回列表需要的字段
  return items.map((p: RealEstatePost) => ({
    title: p.title,
    slug: p.slug,
    summary: p.summary,
    publishDate: p.publishDate,
    dealType: p.dealType,
    category: p.category,
    coverImageUrl: p.coverImageUrl,
  }));
}

/**
 * ✅ 按 slug 获取详情（用于 /real-estate/[slug]）
 */
export async function getRealEstatePostBySlug(slug: string) {
  const base: Record<string, string> = {
    content_type: REAL_ESTATE_CT,
    limit: "1",
    include: "2",
  };

  const q1 = "?" + new URLSearchParams({ ...base, "fields.slug": slug }).toString();
  const q2 = "?" + new URLSearchParams({ ...base, "fields.slug[in]": slug }).toString();

  let data: any;
  try {
    data = await cfFetch(`/entries${q1}`);
  } catch {
    data = await cfFetch(`/entries${q2}`);
  }

  const it = data?.items?.[0];
  if (!it) return null;

  const post = normalizePost(it);
  return post as RealEstatePostDetail;
}

/**
 * ✅ 获取所有 slug（用于 getStaticPaths）
 * 可选过滤：sale/rent/category（你如果以后要拆不同目录的静态路径会用到）
 */
export async function getAllRealEstateSlugs(filter?: { dealType?: DealType; category?: string }) {
  const base: Record<string, string> = {
    content_type: REAL_ESTATE_CT,
    select: "fields.slug,fields.dealType,fields.type,fields.category,fields.tag",
    limit: "1000",
  };

  const q1: Record<string, string> = { ...base };
  const q2: Record<string, string> = { ...base };

  if (filter?.dealType) {
    q1["fields.dealType"] = filter.dealType;
    q2["fields.type"] = filter.dealType;
  }
  if (filter?.category) {
    q1["fields.category"] = filter.category;
    q2["fields.tag"] = filter.category;
  }

  const qs1 = "?" + new URLSearchParams(q1).toString();
  const qs2 = "?" + new URLSearchParams(q2).toString();

  let data: any;
  try {
    data = await cfFetch(`/entries${qs1}`);
  } catch {
    data = await cfFetch(`/entries${qs2}`);
  }

  return (data?.items || [])
    .map((it: any) => it?.fields?.slug)
    .filter((s: any) => typeof s === "string" && s.length > 0);
}