export const onRequestPost = async ({ request, env }) => {
  const data = await request.json();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "网站表单 <no-reply@cendantproperty.com.au>",
      to: [env.MAIL_TO],
      subject: "网站新咨询",
      html: `
        <p>姓名：${data.name}</p>
        <p>邮箱：${data.email}</p>
        <p>电话：${data.phone}</p>
        <p>内容：${data.message}</p>
      `,
    }),
  });

  return new Response(
    JSON.stringify({ ok: res.ok }),
    { status: res.ok ? 200 : 500 }
  );
};
