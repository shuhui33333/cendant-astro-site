// src/pages/api/translate.ts
import type { APIRoute } from "astro";

export const prerender = false;

// 允许的 target（你前端要：简体/繁体台/繁体港/英文）
const ALLOWED_TARGETS = new Set(["en", "zh-CN", "zh-TW", "zh-HK"]);

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const POST: APIRoute = async (ctx) => {
  try {
    // 1) 读取并解析 body（用 text + try/catch，避免 JSON 解析崩掉）
    const raw = await ctx.request.text();
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ error: "Bad JSON", raw }, 400);
    }

    const target = String(body?.target || "");
    const texts = body?.texts;

    if (!ALLOWED_TARGETS.has(target)) {
      return json(
        { error: "Invalid target", allowed: Array.from(ALLOWED_TARGETS) },
        400
      );
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      return json({ error: "Bad request: texts must be non-empty array" }, 400);
    }

    // 2) 读取 API KEY（Cloudflare Pages 线上用 locals.runtime.env；本地用 process.env）
    const apiKey =
      (ctx.locals as any)?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY ||
      (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
      return json(
        {
          error: "Missing GOOGLE_TRANSLATE_API_KEY",
          hint:
            "本地请在项目根目录创建 .env 并写入 GOOGLE_TRANSLATE_API_KEY=xxx，然后重启 npm run dev；线上请在 Cloudflare Pages 变量/机密里设置并重新部署",
        },
        500
      );
    }

    // 3) 调 Google Translate（建议用 key 放 query 的 v2 方式，你现在就是）
    const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texts,
        target,
        format: "text",
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      // 把 Google 的错误原样吐回去，方便你在 Network 里直接看原因
      return json(
        {
          error: "Google Translate API error",
          status: res.status,
          details: data,
        },
        502
      );
    }

    const out = (data?.data?.translations || []).map((t: any) => t.translatedText);
    return json({ data: out }, 200);
  } catch (e: any) {
    return json(
      { error: "Internal error", message: String(e?.message || e) },
      500
    );
  }
};

// （可选）给 GET 一个提示，避免你误访问看到 405
export const GET: APIRoute = async () => {
  return json({ ok: true, method: "GET not supported, use POST" }, 200);
};