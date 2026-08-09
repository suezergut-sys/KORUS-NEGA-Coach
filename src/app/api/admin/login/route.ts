export async function POST() {
  return Response.json({ error: "Отдельный вход администратора больше не используется." }, { status: 410 });
}
