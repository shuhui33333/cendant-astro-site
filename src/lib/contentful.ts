const SPACE = import.meta.env.CONTENTFUL_SPACE_ID;
const TOKEN = import.meta.env.CONTENTFUL_DELIVERY_TOKEN;

// ✅ 这里填你 Contentful Content Type 的 API Identifier
// 例如：realEstatePost / real_estate_post / post / article ...
const REAL_ESTATE_CONTENT_TYPE = import.meta.env.CONTENTFUL_REAL_ESTATE_TYPE || "realEstatePost";

const BASE = `https://cdn.contentful.com/spaces/${SPACE}`;

async function cfFetch(path: string) {
  // ✅ 没配环境变量时不要让 Cloudflare build 直接挂
  if (!SPACE || !TOKEN) {
    throw new Error("Missing CONTENTFUL_SPACE_ID or CONTENTFUL_DELIVERY_TOKEN");
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  // ✅ 输出更清晰的报错
  const text = await res.text();
  if (!res.ok) throw new Error(`Contentful error ${res.status}: ${text}`);

  return JSON.parse(text);
}

export async function getRealEstatePosts(limit = 20) {
  try {
    const data = await cfFetch(
      `/entries?content_type=${REAL_ESTATE_CONTENT_TYPE}&order=-fields.publishDate&limit=${limit}`
    );

    return (data.items || []).map((it: any) => ({
      title: it.fields?.title ?? "",
      slug: it.fields?.slug ?? "",
      publishDate: it.fields?.publishDate ?? "",
      summary: it.fields?.summary ?? "",
    }));
  } catch (e) {
    // ✅ 内容没配好时，列表页返回空，不阻塞构建
    return [];
  }
}

export async function getRealEstatePostBySlug(slug: string) {
  try {
    const data = await cfFetch(
      `/entries?content_type=${REAL_ESTATE_CONTENT_TYPE}&fields.slug=${encodeURIComponent(slug)}&limit=1`
    );

    const it = data.items?.[0];
    if (!it) return null;

    return {
      title: it.fields?.title ?? "",
      slug: it.fields?.slug ?? "",
      publishDate: it.fields?.publishDate ?? "",
      summary: it.fields?.summary ?? "",
      body: it.fields?.body ?? null, // Rich text
    };
  } catch (e) {
    return null;
  }
}

export async function getAllRealEstateSlugs() {
  try {
    const data = await cfFetch(
      `/entries?content_type=${REAL_ESTATE_CONTENT_TYPE}&select=fields.slug&limit=1000`
    );

    return (data.items || [])
      .map((it: any) => it.fields?.slug)
      .filter(Boolean);
  } catch (e) {
    // ✅ 关键：getStaticPaths 用它时，返回空数组就不会 build 失败
    return [];
  }
}
