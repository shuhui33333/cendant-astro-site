// functions/_middleware.ts
import { translateHtmlDocument } from "./_utils/translateHtml";

export const onRequest: PagesFunction = async (ctx) => {
  const { request } = ctx;

  // 只处理 GET
  if (request.method !== "GET") return ctx.next();

  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "zh").toLowerCase();

  // 只在 lang=en 时翻译；其他语言直接原样返回
  if (lang !== "en") return ctx.next();

  // 只翻译 HTML 页面（避免翻译图片/js/css）
  const accept = request.headers.get("accept") || "";
  const looksHtml = accept.includes("text/html") || url.pathname.endsWith("/") || !url.pathname.includes(".");
  if (!looksHtml) return ctx.next();

  // ✅ 缓存：同一页面+lang=en 只翻译一次
  const cacheKeyUrl = new URL(request.url);
  cacheKeyUrl.searchParams.set("lang", "en"); // 统一 key
  const cacheKey = new Request(cacheKeyUrl.toString(), request);
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  // 先拿 Astro/静态页面的原始 HTML
  const res = await ctx.next();
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html")) return res;

  const html = await res.text();

  const apiKey =
    (ctx.env as any)?.GOOGLE_TRANSLATE_API_KEY ||
    (ctx.env as any)?.GOOGLE_API_KEY ||
    "";

  if (!apiKey) {
    // 没有 key 就不翻译（不让网站挂掉）
    return new Response(html, res);
  }

  // 翻译（只翻译文本节点）
  const translated = await translateHtmlDocument(html, {
    target: "en",
    apiKey,
  });

  const out = new Response(translated, res);
  out.headers.set("content-language", "en");
  out.headers.set("cache-control", "public, max-age=3600"); // 浏览器侧缓存 1h（可调整）

  // 写入 Cloudflare Cache（边缘缓存）
  await cache.put(cacheKey, out.clone());

  return out;
};
