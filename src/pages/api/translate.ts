// src/pages/api/translate.ts
import type { APIRoute } from "astro";

type ReqBody = {
  target?: string;      // "en"
  texts?: string[];     // 批量文本
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = (await request.json()) as ReqBody;
    const target = (body.target || "en").toString();
    const texts = Array.isArray(body.texts) ? body.texts : [];

    if (!texts.length) {
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ✅ 读取 Cloudflare Pages 环境变量
    // Astro + Cloudflare adapter 下：locals.runtime.env
    const env = (locals as any)?.runtime?.env || {};
    const key = env.GOOGLE_TRANSLATE_API_KEY as string | undefined;

    if (!key) {
      return new Response(
        JSON.stringify({ error: "Missing GOOGLE_TRANSLATE_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Google Translate v2 批量接口
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
      return new Response(
        JSON.stringify({
          error: "Google translate failed",
          status: res.status,
          detail: json,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const out: string[] =
      json?.data?.translations?.map((x: any) => x?.translatedText ?? "") ?? [];

    return new Response(JSON.stringify({ data: out }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || "translate error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};