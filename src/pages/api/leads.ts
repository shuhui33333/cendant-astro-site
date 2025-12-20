// src/pages/api/leads.ts
import type { APIRoute } from "astro";

type LeadPayload = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  subject?: string;
  source?: string; // 可选：页面来源
};

// ✅ 从 Cloudflare Pages runtime env 取变量（最关键）
function getEnv(locals: any, key: string): string | undefined {
  // Cloudflare adapter (runtime)
  const v1 = locals?.runtime?.env?.[key];
  if (typeof v1 === "string" && v1.trim()) return v1.trim();

  // Node fallback (本地 dev 有时会走这里)
  const v2 = (globalThis as any)?.process?.env?.[key];
  if (typeof v2 === "string" && v2.trim()) return v2.trim();

  return undefined;
}

function json(data: any, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

// ✅ 简单 email 校验
function isEmail(s?: string) {
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

// ✅ 防止邮件注入/过长
function cleanText(s?: string, max = 2000) {
  if (!s) return "";
  return String(s)
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, max);
}

// ✅ 允许跨域（你是同域请求也没问题；加上更稳）
function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function readBody(request: Request): Promise<LeadPayload> {
  const ct = request.headers.get("content-type") || "";

  // JSON
  if (ct.includes("application/json")) {
    const raw = await request.text();
    if (!raw) return {};
    try {
      return JSON.parse(raw);
    } catch {
      // 有些情况下 body 被截断或空，会导致 JSON parse error
      return {};
    }
  }

  // Form (application/x-www-form-urlencoded)
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      message: String(form.get("message") ?? ""),
      subject: String(form.get("subject") ?? ""),
      source: String(form.get("source") ?? ""),
    };
  }

  // 兜底：尝试 text -> json
  const raw = await request.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const cors = corsHeaders(request);

  try {
    const RESEND_API_KEY = getEnv(locals, "RESEND_API_KEY");
    const MAIL_TO = getEnv(locals, "MAIL_TO");
    // ✅ 你可以不配 MAIL_FROM；但强烈建议配一个已在 Resend 验证过的发件人
    const MAIL_FROM =
      getEnv(locals, "MAIL_FROM") ||
      "Cendant Website <onboarding@resend.dev>"; // 默认值：仅用于快速验证

    if (!RESEND_API_KEY) {
      return json(
        { ok: false, error: "Missing RESEND_API_KEY (Cloudflare Pages Variables/Secrets)" },
        500,
        cors
      );
    }
    if (!MAIL_TO) {
      return json(
        { ok: false, error: "Missing MAIL_TO (Cloudflare Pages Variables)" },
        500,
        cors
      );
    }

    const body = await readBody(request);

    const name = cleanText(body.name, 120);
    const email = cleanText(body.email, 160);
    const phone = cleanText(body.phone, 60);
    const message = cleanText(body.message, 4000);
    const subject = cleanText(body.subject, 160) || "New lead from website";
    const source = cleanText(body.source, 300);

    // ✅ 基础必填校验（你可以按你的表单字段改）
    if (!name) return json({ ok: false, error: "Name is required" }, 400, cors);
    if (!isEmail(email)) return json({ ok: false, error: "Valid email is required" }, 400, cors);
    if (!message) return json({ ok: false, error: "Message is required" }, 400, cors);

    // ✅ 发送到 Resend
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6">
        <h2>New Lead (Cendant Website)</h2>
        <p><b>Name:</b> ${escapeHtml(name)}</p>
        <p><b>Email:</b> ${escapeHtml(email)}</p>
        <p><b>Phone:</b> ${escapeHtml(phone || "-")}</p>
        <p><b>Source:</b> ${escapeHtml(source || request.headers.get("referer") || "-")}</p>
        <hr />
        <p><b>Message:</b></p>
        <pre style="white-space: pre-wrap; background:#f6f6f6; padding:12px; border-radius:8px">${escapeHtml(
          message
        )}</pre>
      </div>
    `.trim();

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: [MAIL_TO],
        reply_to: email, // ✅ 你点“回复”会直接回到客户邮箱
        subject: `[Website Lead] ${subject}`,
        html,
      }),
    });

    const resendJson = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error("[leads] Resend failed", {
        status: resendRes.status,
        body: resendJson,
      });
      // 把 Resend 的错误信息透出一点，方便你排查（不含 key）
      return json(
        {
          ok: false,
          error: "Email service failed",
          details: resendJson,
        },
        502,
        cors
      );
    }

    return json({ ok: true, id: resendJson?.id ?? null }, 200, cors);
  } catch (e: any) {
    console.error("[leads] Uncaught error", e);
    return json({ ok: false, error: String(e?.message || e) }, 500, cors);
  }
};

// --- helpers ---
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}