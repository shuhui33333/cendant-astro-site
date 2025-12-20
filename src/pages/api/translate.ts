export const prerender = false;

type Body = {
  target: "en" | "zh-CN" | "zh-TW" | "zh-HK";
  texts: string[];
  source?: string; // 可选
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

export async function POST({ request }: { request: Request }) {
  try {
    const key =
      // Astro/Cloudflare 通常是 import.meta.env
      (import.meta as any).env?.GOOGLE_TRANSLATE_API_KEY ??
      // 兜底
      (globalThis as any)?.process?.env?.GOOGLE_TRANSLATE_API_KEY;

    if (!key) {
      return json(
        {
          error: "Missing GOOGLE_TRANSLATE_API_KEY in environment variables.",
        },
        500
      );
    }

    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      return json(
        { error: "Content-Type must be application/json" },
        415
      );
    }

    const body = (await request.json()) as Body;

    if (!body?.target || !Array.isArray(body.texts)) {
      return json(
        { error: "Bad request: need { target, texts[] }" },
        400
      );
    }

    // 过滤空字符串，避免 Google 报错/浪费
    const texts = body.texts
      .map((s) => (typeof s === "string" ? s : ""))
      .map((s) => s.trim())
      .filter(Boolean);

    if (texts.length === 0) return json({ data: [] });

    // Google Translate v2 REST
    const url = new URL("https://translation.googleapis.com/language/translate/v2");
    url.searchParams.set("key", key);

    const payload: any = {
      q: texts,              // 注意：这里是数组
      target: body.target,   // en / zh-CN / zh-TW / zh-HK
      format: "text",
    };
    if (body.source) payload.source = body.source;

    const resp = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { raw };
    }

    if (!resp.ok) {
      return json(
        {
          error: "Google translate failed",
          status: resp.status,
          details: parsed,
        },
        502
      );
    }

    const out: string[] =
      parsed?.data?.translations?.map((x: any) => x?.translatedText ?? "") ?? [];

    return json({ data: out });
  } catch (err: any) {
    // 关键：永远返回 JSON（避免你现在看到的 502 空对象）
    return json(
      {
        error: "Worker crashed in /api/translate",
        message: String(err?.message ?? err),
        stack: err?.stack ?? null,
      },
      500
    );
  }
}

export async function GET() {
  return json({ error: "Method Not Allowed" }, 405);
}
