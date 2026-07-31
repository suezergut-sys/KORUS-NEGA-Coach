const TELEGRAM_API_ROOT = "https://api.telegram.org";

type TelegramMessageOptions = {
  parseMode?: "HTML";
  disableLinkPreview?: boolean;
};

export async function sendTelegramMessage(chatId: string, text: string, options: TelegramMessageOptions = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN не настроен.");
  if (!chatId.trim()) throw new Error("Не настроен Telegram chat ID.");

  const response = await fetch(`${TELEGRAM_API_ROOT}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: new TextEncoder().encode(JSON.stringify({
      chat_id: chatId,
      text,
      ...(options.parseMode ? { parse_mode: options.parseMode } : {}),
      ...(options.disableLinkPreview ? { link_preview_options: { is_disabled: true } } : {}),
    })),
    cache: "no-store",
    signal: AbortSignal.timeout(7_000),
  });

  if (!response.ok) {
    let description = `HTTP ${response.status}`;
    try {
      const body = await response.json() as { description?: string };
      if (body.description) description = body.description;
    } catch {
      // Telegram иногда возвращает ответ без JSON; статуса достаточно для диагностики.
    }
    throw new Error(`Telegram отклонил сообщение: ${description}`);
  }
}
