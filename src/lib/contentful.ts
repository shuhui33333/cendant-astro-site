const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;

const BASE = `https://cdn.contentful.com/spaces/${SPACE}`;

async function cfFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Contentful error ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function getRealEstatePosts(limit = 20) {
  // 按发布日期倒序
  const data = await cfFetch(
    `/entries?content_type=realEstatePost&order=-fields.publishDate&limit=${limit}`
  );
  return data.items.map((it: any) => ({
    title: it.fields.title,
    slug: it.fields.slug,
    publishDate: it.fields.publishDate,
    summary: it.fields.summary,
  }));
}

export async function getRealEstatePostBySlug(slug: string) {
  const data = await cfFetch(
    `/entries?content_type=realEstatePost&fields.slug=${encodeURIComponent(slug)}&limit=1`
  );
  const it = data.items?.[0];
  if (!it) return null;

  return {
    title: it.fields.title,
    slug: it.fields.slug,
    publishDate: it.fields.publishDate,
    summary: it.fields.summary,
    body: it.fields.body, // Rich text
  };
}

export async function getAllRealEstateSlugs() {
  const data = await cfFetch(`/entries?content_type=realEstatePost&select=fields.slug&limit=1000`);
  return data.items.map((it: any) => it.fields.slug).filter(Boolean);
}
