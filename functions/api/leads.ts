export const onRequestPost = async ({ request, env }) => {
  const data = await request.json();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "网站表单 <no-reply@cendantproperty.com.au>",
      to: [env.MAIL_TO],
      subject: "网站新咨询",
      html: `
        <h2>新表单提交</h2>
        <p><b>姓名：</b>${data.name}</p>
        <p><b>邮箱：</b>${data.email}</p>
        <p><b>电话：</b>${data.phone || "-"}</p>
        <p><b>咨询内容：</b>${data.message}</p>
      `,
    }),
  });

  if (!res.ok) {
    return new Response("Email failed", { status: 500 });
  }

  return new Response("OK");
};
