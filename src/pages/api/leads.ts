// src/pages/api/leads.ts
import type { APIRoute } from "astro";

function getEnv(locals: any, key: string): string | undefined {
  // Cloudflare Pages/Workers runtime env
  const v1 = locals?.runtime?.env?.[key];
  // fallback for local dev / other adapters
  const v2 = (globalThis as any)?.process?.env?.[key];
  return (v1 ?? v2) as string | undefined;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      // 同域一般不需要，但留着更稳（你表单是站内请求）
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const RESEND_API_KEY = getEnv(locals, "RESEND_API_KEY");
    const MAIL_TO = getEnv(locals, "MAIL_TO") || "info@cendantpgau.com";

    // ⚠️ 必须是你在 Resend 已验证域名下的邮箱
    // 例如：noreply@cendantproperty.com.au
    const MAIL_FROM =
      getEnv(locals, "MAIL_FROM") || "Cendant Website <noreply@cendantproperty.com.au>";

    if (!RESEND_API_KEY) return json({ error: "Missing env: RESEND_API_KEY" }, 500);
    if (!MAIL_TO) return json({ error: "Missing env: MAIL_TO" }, 500);

    const body = await request.json().catch(() => null);
    if (!body) return json({ error: "Bad JSON body" }, 400);

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const message = String(body.message ?? "").trim();
    const subject = String(body.subject ?? "New website lead").trim();

    if (!name || !email || !message) {
      return json({ error: "Missing required fields: name/email/message" }, 400);
    }

    const html = `
      <h2>New Website Lead</h2>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "-")}</p>
      <p><strong>Message:</strong></p>
      <pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(
        message
      )}</pre>
    `;

    const payload = {
      from: MAIL_FROM,
      to: [MAIL_TO],
      subject: `📩 ${subject}`,
      html,
      // 你说“不需要发给客户”，这里不发送给客户，只是方便你点“回复”：
      reply_to: email,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      console.error("[leads] Resend failed", { status: res.status, body: text });
      return json({ error: "Resend failed", status: res.status }, 502);
    }

    return json({ ok: true });
  } catch (e: any) {
    console.error("[leads] Internal error", e);
    return json({ error: String(e?.message || e) }, 500);
  }
};

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}