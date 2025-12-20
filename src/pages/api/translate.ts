// src/pages/api/translate.ts
import type { APIRoute } from "astro";
import { getRuntime } from "@astrojs/cloudflare/runtime";

type ReqBody = {
  target: "en" | "zh-CN" | "zh-TW" | "zh-HK";
  texts: string[];
  source?: "zh-CN" | "zh-TW" | "zh-HK" | "en";
};

export const POST: APIRoute = async (context) => {
  try {
    const runtime = getRuntime(context);
    const envKey =
      runtime?.env?.GOOGLE_TRANSLATE_API_KEY ||
      (import.meta as any).env?.GOOGLE_TRANSLATE_API_KEY ||
      (process as any)?.env?.GOOGLE_TRANSLATE_API_KEY;

    if (!envKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing GOOGLE_TRANSLATE_API_KEY in environment variables. (Cloudflare Pages 需要重新部署后才生效，并确认 Production 环境已配置)",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await context.request.json()) as ReqBody;
    const target = body?.target;
    const texts = Array.isArray(body?.texts) ? body.texts : [];

    if (!target || !Array.isArray(texts) || texts.length === 0) {
      return new Response(
        JSON.stringify({ error: "Bad request: target/texts required." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Google v2 Translate: 一次可以传多条 q
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      envKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texts,
        target,
        format: "text",
        // source: body.source || "zh-CN", // 如果你想固定源语言可打开
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "Google Translate API error",
          status: res.status,
          detail: json,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const out: string[] =
      json?.data?.translations?.map((t: any) => t.translatedText) || [];

    return new Response(JSON.stringify({ data: out }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Server error", detail: String(e?.message || e) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};