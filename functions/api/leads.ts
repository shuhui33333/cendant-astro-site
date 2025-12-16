export const onRequestPost: PagesFunction = async ({ request }) => {
  const data = await request.json().catch(() => ({}));

  // 最小校验
  if (!data?.name || !data?.email || !data?.message) {
    return new Response(JSON.stringify({ ok: false, error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 这里先只回显（后面再加：存库/发邮件/Turnstile）
  return new Response(JSON.stringify({ ok: true, received: data }), {
    headers: { "Content-Type": "application/json" },
  });
};
