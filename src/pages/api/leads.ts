import { Resend } from "resend";

const resend = new Resend(import.meta.env.RESEND_API_KEY);

export async function POST({ request }: { request: Request }) {
  const { name, email, phone, message } = await request.json();

  // 最基础校验（防空提交）
  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({ error: "Missing required fields" }),
      { status: 400 }
    );
  }

  await resend.emails.send({
    from: "Cendant Website <noreply@cendantproperty.com.au>", // ✅ 固定
    to: ["info@cendantpgau.com"],                             // ✅ 你收
    subject: "📩 新的官网客户留言",
    html: `
      <h2>新的客户咨询</h2>
      <p><strong>姓名：</strong>${name}</p>
      <p><strong>邮箱：</strong>${email}</p>
      <p><strong>电话：</strong>${phone ?? "-"}</p>
      <p><strong>留言内容：</strong></p>
      <p>${message}</p>
    `,
    // replyTo: email, // ← 可选：以后想“直接回复客户”再开
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}