// src/pages/api/translate.ts
import type { APIRoute } from "astro";

export const prerender = false;

type Body = {
  target?: string;
  text?: string;     // 兼容单个字符串
  texts?: string[];  // 正常批量
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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const GET: APIRoute = async () => {
  return json({ ok: true, route: "/api/translate" }, 200, CORS_HEADERS);
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json().catch(() => null)) as Body | null;

    const target = (body?.target || "").trim();
    const allow = new Set(["en", "zh-CN", "zh-TW", "zh-HK"]);
    if (!allow.has(target)) {
      return json(
        { error: "Unsupported target", target, allow: Array.from(allow) },
        400,
        CORS_HEADERS
      );
    }

    // ✅ 兼容 text / texts
    const incomingTexts: string[] =
      Array.isArray(body?.texts) ? body!.texts! :
      typeof body?.text === "string" ? [body.text] :
      [];

    const texts = incomingTexts
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean);

    if (texts.length === 0) {
      return json(
        { error: "Bad request", hint: "Need { target, texts[] } or { target, text }" },
        400,
        CORS_HEADERS
      );
    }

    // ✅ 最稳的 env 读取（Cloudflare Pages Functions）
    const apiKey =
      (locals as any)?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY ||
      (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY;

    if (!apiKey) {
      return json(
        {
          error: "Missing GOOGLE_TRANSLATE_API_KEY",
          hint:
            "Cloudflare Pages: Settings -> Variables and Secrets -> add GOOGLE_TRANSLATE_API_KEY, then redeploy. Local dev: create .dev.vars",
        },
        500,
        CORS_HEADERS
      );
    }

    // ✅ 分批（避免一次太大导致 Google 400/413，也更省钱）
    const BATCH = 50;
    const out: string[] = [];

    for (let i = 0; i < texts.length; i += BATCH) {
      const part = texts.slice(i, i + BATCH);

      const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
        apiKey
      )}`;

      const googleRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: part, target, format: "text" }),
      });

      // 这里一定要拿到 text，方便看错误
      const rawText = await googleRes.text();
      let googleJson: any = null;
      try {
        googleJson = rawText ? JSON.parse(rawText) : null;
      } catch {
        googleJson = { raw: rawText };
      }

      if (!googleRes.ok) {
        return json(
          {
            error: "Google Translate API error",
            status: googleRes.status,
            details: googleJson,
          },
          502,
          CORS_HEADERS
        );
      }

      const translations = googleJson?.data?.translations;
      if (!Array.isArray(translations)) {
        return json(
          { error: "Unexpected Google response shape", details: googleJson },
          502,
          CORS_HEADERS
        );
      }

      for (const t of translations) out.push(String(t?.translatedText ?? ""));
    }

    return json({ data: out }, 200, CORS_HEADERS);
  } catch (e: any) {
    return json(
      { error: "Internal error", message: String(e?.message || e), stack: String(e?.stack || "") },
      500,
      CORS_HEADERS
    );
  }
};