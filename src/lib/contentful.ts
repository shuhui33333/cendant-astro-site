// src/lib/contentful.ts
export type RealEstatePost = {
  title: string;
  slug: string;
  publishDate?: string;
  summary?: string;
  category?: string;
};

const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;

// Contentful Delivery API base
const BASE = `https://cdn.contentful.com/spaces/${SPACE}`;

async function cfFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`Contentful error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** 获取地产资讯列表 */
export async function getRealEstatePosts(limit: number = 20): Promise<RealEstatePost[]> {
  const data = await cfFetch(
    `/entries?content_type=realEstatePost&order=-fields.publishDate&limit=${limit}`
  );

  const items: any[] = Array.isArray(data?.items) ? data.items : [];

  return items.map((it) => ({
    title: it?.fields?.title ?? "",
    slug: it?.fields?.slug ?? "",
    publishDate: it?.fields?.publishDate,
    summary: it?.fields?.summary,
    category: it?.fields?.category,
  })).filter((x) => x.slug && x.title);
}
