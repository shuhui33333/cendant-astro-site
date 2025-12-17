const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;

const BASE = `https://cdn.contentful.com/spaces/${SPACE}`;

async function cfFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Contentful error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/**
 * 获取地产资讯列表
 */
export async function getRealEstatePosts(limit = 20) {
  const data = await cfFetch(
    `/entries?content_type=realEstatePost&order=-fields.publishDate&limit=${limit}`
  );

  return data.items.map((it: any) => ({
    title: it.fields.title,
    slug: it.fields.slug,
    publishDate: it.fields.publishDate,
    category: it.fields.category,
    dealType: it.fields.dealType,
    image: it.fields.image?.[0]?.fields?.file?.url ?? null,
  }));
}

/**
 * 根据 slug 获取单篇文章
 */
export async function getRealEstatePostBySlug(slug: string) {
  const data = await cfFetch(
    `/entries?content_type=realEstatePost&fields.slug=${slug}&limit=1`
  );

  const it = data.items?.[0];
  if (!it) return null;

  return {
    title: it.fields.title,
    slug: it.fields.slug,
    publishDate: it.fields.publishDate,
    category: it.fields.category,
    dealType: it.fields.dealType,
    body: it.fields.body,
    image: it.fields.image?.[0]?.fields?.file?.url ?? null,
  };
}
