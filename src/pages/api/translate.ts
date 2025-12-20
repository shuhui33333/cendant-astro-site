// src/pages/api/translate.ts
export const prerender = false;

type TranslateReq = {
  target: string;           // "en" | "zh-TW" | "zh-HK" | ...
  texts: string[];          // 批量文本
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST({ request, locals }: any) {
  try {
    const body = (await request.json()) as TranslateReq;

    if (!body || !Array.isArray(body.texts) || !body.texts.length) {
      return json({ error: "Missing texts[]" }, 400);
    }
    if (!body.target) return json({ error: "Missing target" }, 400);

    // ✅ 从 Cloudflare 环境变量读取 Google 翻译 Key
    // 你在 Cloudflare 里设置的变量名如果不是 GOOGLE_TRANSLATE_API_KEY，请把这里改成你的
    const env = locals?.runtime?.env;
    const apiKey =
      env?.GOOGLE_TRANSLATE_API_KEY ||
      env?.GOOGLE_API_KEY ||
      env?.TRANSLATE_API_KEY;

    if (!apiKey) {
      return json({ error: "Missing GOOGLE_TRANSLATE_API_KEY in environment" }, 500);
    }

    // Google Translate v2
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;

    // ✅ q 支持数组，一次请求翻译多句
    const googleRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: body.texts,
        target: body.target,
        format: "text",
      }),
    });

    const gJson: any = await googleRes.json().catch(() => ({}));

    if (!googleRes.ok) {
      return json(
        {
          error: "Google translate failed",
          status: googleRes.status,
          details: gJson,
        },
        502
      );
    }

    const translated: string[] =
      gJson?.data?.translations?.map((t: any) => t.translatedText) ?? [];

    return json({ data: translated });
  } catch (e: any) {
    return json({ error: e?.message || "Server error" }, 500);
  }
}

// （可选）如果有人 GET 访问，明确返回 405，方便你排查
export async function GET() {
  return json({ error: "Method Not Allowed. Use POST /api/translate" }, 405);
}
