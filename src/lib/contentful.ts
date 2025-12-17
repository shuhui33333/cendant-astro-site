const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;
const ENV = import.meta.env.CONTENTFUL_ENVIRONMENT ?? "master";

if (!SPACE) throw new Error("Missing env: CONTENTFUL_SPACE_ID");
if (!TOKEN) throw new Error("Missing env: CONTENTFUL_DELIVERY_TOKEN");

const BASE = `https://cdn.contentful.com/spaces/${SPACE}/environments/${ENV}`;

async function cfFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`Contentful error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

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
