// src/pages/api/translate.ts
import type { APIRoute } from "astro";

type ReqBody = {
  target: "en" | "zh-CN" | "zh-TW" | "zh-HK";
  texts: string[];
};

function getEnvKey(context: any) {
  // Cloudflare Pages + Astro adapter 通常会把 env 放在 locals.runtime.env
  const fromRuntime = context?.locals?.runtime?.env?.GOOGLE_TRANSLATE_API_KEY;
  const fromProcess = (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY;
  return fromRuntime || fromProcess || "";
}

export const POST: APIRoute = async (context) => {
  try {
    const apiKey = getEnvKey(context);

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Missing GOOGLE_TRANSLATE_API_KEY in environment variables.（你需要确保 Cloudflare Pages -> Production 环境变量已设置，并且部署成功）",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = (await context.request.json()) as ReqBody;
    const target = body?.target;
    const texts = Array.isArray(body?.texts) ? body.texts : [];

    if (!target || texts.length === 0) {
      return new Response(JSON.stringify({ error: "Bad request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      apiKey
    )}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: texts,
        target,
        format: "text",
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: "Google API error", status: res.status, detail: json }),
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