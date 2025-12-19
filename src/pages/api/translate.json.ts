// src/pages/api/translate.json.ts
import type { APIRoute } from "astro";

export const prerender = false;

type ReqBody = {
  target: "en" | "zh-CN";
  texts: string[];
};

function cleanTexts(texts: string[]) {
  return (texts || [])
    .map((s) => String(s ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 120); // 防止一次塞太多
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const key = import.meta.env.GOOGLE_TRANSLATE_API_KEY;
    if (!key) {
      return new Response(JSON.stringify({ error: "Missing GOOGLE_TRANSLATE_API_KEY" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as ReqBody;
    const target = body?.target || "en";
    const texts = cleanTexts(body?.texts || []);
    if (!texts.length) {
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Google Cloud Translation Basic v2 endpoint (API key)
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(
      key
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
      return new Response(JSON.stringify({ error: "Translate failed", detail: json }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const translated: string[] =
      json?.data?.translations?.map((t: any) => t?.translatedText ?? "") ?? [];

    return new Response(JSON.stringify({ data: translated }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};