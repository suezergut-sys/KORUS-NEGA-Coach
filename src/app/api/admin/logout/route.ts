export async function POST() {
  return Response.json({ error: "Используйте общий выход из платформы." }, { status: 410 });
}
