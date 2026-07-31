import { getSupabaseAdmin } from "@/lib/supabase-server";
import { sendTelegramMessage } from "@/lib/telegram";
import { formatActivityMessage, type UserActivityType } from "@/lib/user-activity-format";

type RecordUserActivityInput = {
  userId: string;
  type: UserActivityType;
  entityId: string;
  subjectTitle?: string | null;
};

/**
 * Сохраняет событие и отправляет оперативное уведомление. Ошибка мониторинга
 * не должна отменять уже завершённое пользовательское действие.
 */
export async function recordUserActivity(input: RecordUserActivityInput) {
  try {
    const db = getSupabaseAdmin();
    const { data: profile, error: profileError } = await db
      .from("user_profiles")
      .select("first_name,last_name")
      .eq("id", input.userId)
      .single();
    if (profileError || !profile) throw new Error(profileError?.message || "Профиль пользователя не найден.");

    const userName = `${profile.first_name || ""} ${profile.last_name || ""}`.replace(/\s+/g, " ").trim();
    const { data: event, error: insertError } = await db
      .from("user_activity_events")
      .insert({
        user_id: input.userId,
        user_name: userName,
        event_type: input.type,
        entity_id: input.entityId,
        subject_title: input.subjectTitle?.trim() || null,
      })
      .select("id")
      .single();

    if (insertError?.code === "23505") return;
    if (insertError || !event) throw new Error(insertError?.message || "Событие активности не сохранено.");

    const chatId = process.env.TELEGRAM_MONITOR_USER_CHAT_ID?.trim();
    if (!chatId) throw new Error("TELEGRAM_MONITOR_USER_CHAT_ID не настроен.");
    await sendTelegramMessage(chatId, formatActivityMessage(userName, input.type, input.subjectTitle));
    const { error: updateError } = await db
      .from("user_activity_events")
      .update({ telegram_sent_at: new Date().toISOString() })
      .eq("id", event.id);
    if (updateError) throw new Error(updateError.message);
  } catch (error) {
    console.error("Не удалось обработать событие Telegram-мониторинга:", error instanceof Error ? error.message : error);
  }
}
