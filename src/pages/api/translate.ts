export const prerender = false;

type TranslateReq = {
  text: string | string[];
  target: string; // 'en' | 'zh-CN' ...
  source?: string; // 可选
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
    ...init,
  });
}

export async function POST({ request }: { request: Request }) {
  try {
    const body = (await request.json()) as TranslateReq;

    const apiKey = (import.meta as any).env.GOOGLE_TRANSLATE_API_KEY as string | undefined;
    if (!apiKey) return json({ error: "Missing GOOGLE_TRANSLATE_API_KEY" }, { status: 500 });

    const texts = Array.isArray(body.text) ? body.text : [body.text];
    const target = body.target || "en";
    const source = body.source;

    if (!texts.length || !target) {
      return json({ error: "text/target required" }, { status: 400 });
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;

    const payload: any = {
      q: texts,
      target,
      format: "text",
    };
    if (source) payload.source = source;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return json({ error: "Google API error", details: data }, { status: 500 });
    }

    const translated = (data?.data?.translations ?? []).map((t: any) => t.translatedText);

    return json({
      target,
      source: data?.data?.translations?.[0]?.detectedSourceLanguage,
      translated,
    });
  } catch (e: any) {
    return json({ error: "Bad request", details: String(e?.message ?? e) }, { status: 400 });
  }
}