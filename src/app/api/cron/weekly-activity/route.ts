import { getSupabaseAdmin } from "@/lib/supabase-server";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  formatWeeklyActivitySummary,
  previousMoscowWeek,
  type WeeklyActivitySummary,
} from "@/lib/user-activity-format";

export const runtime = "nodejs";

type SummaryRow = {
  active_users?: number | string;
  played_cases?: number | string;
  created_cases?: number | string;
  uploaded_cases?: number | string;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Недопустимый ключ фонового задания." }, { status: 401 });
  }

  try {
    const week = previousMoscowWeek();
    const db = getSupabaseAdmin();
    const { data: existing, error: existingError } = await db
      .from("user_activity_weekly_reports")
      .select("sent_at")
      .eq("period_start", week.startDate)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing?.sent_at) return Response.json({ ok: true, alreadySent: true, periodStart: week.startDate });

    const { error: reserveError } = await db
      .from("user_activity_weekly_reports")
      .upsert(
        { period_start: week.startDate, period_end: week.endDate },
        { onConflict: "period_start", ignoreDuplicates: true },
      );
    if (reserveError) throw new Error(reserveError.message);

    const { data, error } = await db.rpc("user_activity_weekly_summary", {
      p_period_start: week.start.toISOString(),
      p_period_end: week.end.toISOString(),
    });
    if (error) throw new Error(error.message);
    const row = (data || {}) as SummaryRow;
    const summary: WeeklyActivitySummary = {
      activeUsers: Number(row.active_users || 0),
      playedCases: Number(row.played_cases || 0),
      createdCases: Number(row.created_cases || 0),
      uploadedCases: Number(row.uploaded_cases || 0),
    };

    const chatId = process.env.TELEGRAM_WEEKLY_CHAT_ID?.trim();
    if (!chatId) throw new Error("TELEGRAM_WEEKLY_CHAT_ID не настроен.");
    await sendTelegramMessage(chatId, formatWeeklyActivitySummary(week, summary));

    const { error: markError } = await db
      .from("user_activity_weekly_reports")
      .update({ sent_at: new Date().toISOString() })
      .eq("period_start", week.startDate);
    if (markError) throw new Error(markError.message);

    return Response.json({ ok: true, periodStart: week.startDate, periodEnd: week.endDate, summary });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Не удалось отправить недельную сводку." },
      { status: 500 },
    );
  }
}
