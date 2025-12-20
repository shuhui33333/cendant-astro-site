// src/pages/api/translate.ts
import type { APIRoute } from "astro";

export const prerender = false; // ✅ 强制这是服务器端路由（避免静态化导致 405）

type Body = {
  target?: "en" | "zh-CN" | "zh-TW" | "zh-HK" | string;
  texts?: string[];
};

function json(data: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

// 允许 OPTIONS（有些环境会先发预检，否则你会看到 405）
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
};

// 可选：用来快速验证接口活着
export const GET: APIRoute = async () => {
  return json({ ok: true, route: "/api/translate" }, 200);
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;
    const target = body?.target;
    const texts = body?.texts;

    if (!target || !Array.isArray(texts) || texts.length === 0) {
      return json({ error: "Bad request", hint: "Need { target, texts[] }" }, 400);
    }

    // ✅ 支持四种语言
    const allow = new Set(["en", "zh-CN", "zh-TW", "zh-HK"]);
    if (!allow.has(target)) {
      return json(
        { error: "Unsupported target", target, allow: Array.from(allow) },
        400
      );
    }

    // ✅ Cloudflare Pages Functions 环境变量读取方式（最稳）
    const apiKey =
      (locals as any)?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY ||
      (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
      return json(
        {
          error: "Missing GOOGLE_TRANSLATE_API_KEY",
          hint:
            "Cloudflare Pages: Settings -> Variables and Secrets -> add GOOGLE_TRANSLATE_API_KEY, then redeploy. Local: create .dev.vars",
        },
        500
      );
    }

    // ✅ 防止一次请求太大（也省钱）
    // 你前端已经分批了，这里再兜底一下
    const safeTexts = texts
      .map((t) => (typeof t === "string" ? t : ""))
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 80);

    if (safeTexts.length === 0) {
      return json({ error: "No valid texts" }, 400);
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      apiKey
    )}`;

    const googleRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: safeTexts,
        target,
        format: "text",
      }),
    });

    const googleJson = await googleRes.json().catch(() => null);

    if (!googleRes.ok) {
      // ✅ 把 Google 返回的错误透传出来，方便你排查（例如 key 无权限、账单没开、限额等）
      return json(
        {
          error: "Google Translate API error",
          status: googleRes.status,
          details: googleJson,
        },
        502
      );
    }

    const translations = googleJson?.data?.translations;
    if (!Array.isArray(translations)) {
      return json(
        { error: "Unexpected Google response shape", details: googleJson },
        502
      );
    }

    const out = translations.map((t: any) => String(t?.translatedText ?? ""));

    return json(
      { data: out },
      200,
      {
        // 如果你未来要跨域也没问题
        "Access-Control-Allow-Origin": "*",
      }
    );
  } catch (e: any) {
    return json({ error: "Internal error", message: String(e?.message || e) }, 500);
  }
};