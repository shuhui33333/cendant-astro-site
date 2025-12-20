// src/pages/api/translate.ts
import type { APIRoute } from "astro";

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

function corsHeaders(origin?: string) {
  // 你是同域调用（same-origin），这里放宽也没问题
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = request.headers.get("Origin") || "*";
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const origin = request.headers.get("Origin") || "*";

  try {
    // 1) 解析 JSON（如果 body 不合法，直接 400）
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Bad JSON body" }, 400, corsHeaders(origin));
    }

    const target = String(body?.target || "").trim();
    const texts = body?.texts;

    if (!target || !Array.isArray(texts) || texts.length === 0) {
      return json(
        { error: "Bad request", hint: "Expect { target: 'en', texts: ['你好'] }" },
        400,
        corsHeaders(origin)
      );
    }

    // 2) 读取 API Key（Cloudflare Pages 最稳：locals.runtime.env）
    const apiKey =
      (locals as any)?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY ||
      (locals as any)?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY || // 保留兼容（重复不影响）
      (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY ||
      "";

    if (!apiKey) {
      // 这里要能在 Worker logs 里看见
      console.error("[translate] Missing GOOGLE_TRANSLATE_API_KEY");
      return json({ error: "Missing GOOGLE_TRANSLATE_API_KEY" }, 500, corsHeaders(origin));
    }

    // 3) 限制一下单次大小，避免太大触发 Google/Worker 限制
    //    （你前端 chunk size=40，很合理，这里只做兜底）
    const safeTexts = texts
      .map((t: any) => (typeof t === "string" ? t : String(t ?? "")))
      .filter((t: string) => t.trim().length > 0)
      .slice(0, 100);

    if (safeTexts.length === 0) {
      return json({ data: [] }, 200, corsHeaders(origin));
    }

    const googleUrl = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      apiKey
    )}`;

    // 4) 调用 Google
    const googleRes = await fetch(googleUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: safeTexts,
        target,
        format: "text",
      }),
    });

    const rawText = await googleRes.text();

    // 5) Google 失败：把 Google 的错误原样返回（并打印到 logs）
    if (!googleRes.ok) {
      console.error("[translate] Google API failed", {
        status: googleRes.status,
        body: rawText?.slice?.(0, 2000),
      });

      // 尝试解析为 JSON（Google 一般是 JSON）
      let parsed: any = null;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = { raw: rawText };
      }

      return json(
        {
          error: "GoogleTranslateError",
          googleStatus: googleRes.status,
          google: parsed,
        },
        502,
        corsHeaders(origin)
      );
    }

    // 6) Google 成功：解析并返回
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("[translate] Google returned non-JSON", rawText?.slice?.(0, 2000));
      return json(
        { error: "Bad response from Google", raw: rawText?.slice?.(0, 2000) },
        502,
        corsHeaders(origin)
      );
    }

    const out =
      parsed?.data?.translations?.map((t: any) => String(t?.translatedText ?? "")) ?? [];

    return json({ data: out }, 200, corsHeaders(origin));
  } catch (e: any) {
    console.error("[translate] Unhandled error", e);
    return json({ error: String(e?.message || e) }, 500, corsHeaders(origin));
  }
};