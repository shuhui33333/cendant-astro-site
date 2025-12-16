export const onRequestPost: PagesFunction = async ({ request, env }) => {
  try {
    return new Response("HIT_FUNCTION", {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "X-Hit": "pages-function",
      },
    });
    const data = await request.json();

    // 基本校验
    if (!data?.name || !data?.email || !data?.message) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const mailTo = env.MAIL_TO;
    const apiKey = env.RESEND_API_KEY;

    if (!mailTo || !apiKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing env vars" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // ⚠️ 这里后面可以换成你的域名邮箱（需要在 Resend 验证域名）
        from: "Cendant Website <onboarding@resend.dev>",
        to: [mailTo],
        subject: `网站新咨询：${data.topic || "咨询"}`,
        html: `
          <h2>网站新表单提交</h2>
          <p><b>姓名：</b>${escapeHtml(data.name)}</p>
          <p><b>邮箱：</b>${escapeHtml(data.email)}</p>
          <p><b>电话：</b>${escapeHtml(data.phone || "-")}</p>
          <p><b>主题：</b>${escapeHtml(data.topic || "-")}</p>
          <p><b>留言：</b>${escapeHtml(data.message)}</p>
        `,
      }),
    });

    const text = await r.text();
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: text }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

// 防注入/防破坏 html
function escapeHtml(input: string) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
