// src/pages/api/translate.ts
import type { APIRoute } from "astro";

type ReqBody = {
  target?: string;      // e.g. "en", "zh-CN", "zh-TW", "zh-HK"
  texts?: string[];     // text array
  source?: string;      // optional, e.g. "zh-CN"
};

function json(body: any, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function getApiKey(locals: any) {
  // ✅ Cloudflare Pages runtime env (most important)
  const fromRuntime = locals?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY;
  if (fromRuntime) return String(fromRuntime);

  // ✅ local dev (.env) in Astro
  const fromImportMeta = (import.meta as any)?.env?.GOOGLE_TRANSLATE_API_KEY;
  if (fromImportMeta) return String(fromImportMeta);

  // ✅ node fallback (rare on CF)
  const fromProcess = (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY;
  if (fromProcess) return String(fromProcess);

  return "";
}

export const POST: APIRoute = async ({ request, locals }) => {
  // ✅ CORS（如果你未来从别的域名调用，可保留；同域也不影响）
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const body = (await request.json()) as ReqBody;

    const target = (body?.target || "").trim();
    const textsRaw = Array.isArray(body?.texts) ? body.texts : [];
    const source = (body?.source || "").trim();

    // 清理：只保留非空字符串
    const texts = textsRaw
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean);

    if (!target || texts.length === 0) {
      return json(
        { error: "Bad request", hint: "Require { target: string, texts: string[] }" },
        400,
        corsHeaders
      );
    }

    const apiKey = getApiKey(locals);
    if (!apiKey) {
      return json(
        {
          error: "Missing GOOGLE_TRANSLATE_API_KEY in runtime environment variables.",
          hint:
            "Cloudflare Pages → Settings → Variables and secrets → add GOOGLE_TRANSLATE_API_KEY (Secret) and REDEPLOY.",
        },
        500,
        corsHeaders
      );
    }

    // ✅ Google Translate API v2 endpoint
    const endpoint = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      apiKey
    )}`;

    const payload: any = {
      q: texts,
      target,
      format: "text",
    };
    if (source) payload.source = source;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = rawText;
    }

    if (!res.ok) {
      // ✅ 把 Google 返回的错误带回去，排错最快
      return json(
        {
          error: "Google Translate API failed",
          status: res.status,
          statusText: res.statusText,
          detail: data,
        },
        502,
        corsHeaders
      );
    }

    const translations = data?.data?.translations;
    if (!Array.isArray(translations)) {
      return json(
        {
          error: "Unexpected Google response shape",
          detail: data,
        },
        502,
        corsHeaders
      );
    }

    const out = translations.map((t: any) => String(t?.translatedText ?? ""));
    return json({ data: out }, 200, corsHeaders);
  } catch (e: any) {
    return json(
      {
        error: "Internal error",
        message: String(e?.message || e),
      },
      500,
      corsHeaders
    );
  }
};

// ✅ 让浏览器预检 OPTIONS 通过（有些情况下会触发）
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