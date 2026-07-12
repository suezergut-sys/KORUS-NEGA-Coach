import "server-only";
import { getOpenAI } from "@/lib/openai-server";
import { mapCaseRow, type CanonicalCase, type CaseRole } from "@/lib/case-types";
import { getSupabaseAdmin } from "@/lib/supabase-server";

const beats = [
  { eyebrow: "КОНТЕКСТ", title: "Ситуация складывается", focus: "общая ситуация, место действия, все ключевые участники" },
  { eyebrow: "КОНФЛИКТ", title: "Интересы сталкиваются", focus: "центральный конфликт и противоречащие позиции участников" },
  { eyebrow: "СТАВКИ", title: "Простого решения нет", focus: "риски, ограничения, цена решения и напряжение" },
  { eyebrow: "ВАША РОЛЬ", title: "Время сделать первый ход", focus: "момент перед переговорами, участники готовы начать поединок" },
];

function rolesOf(item: CanonicalCase) { return [item.userRole, item.opponentRole, ...(item.additionalRoles || [])]; }
function list(values: string[]) { return values.join("; "); }
function narrationFor(item: CanonicalCase, role: CaseRole, index: number) {
  const roles = rolesOf(item);
  const all = roles.map((r) => `${r.name}, ${r.position}: цель — ${r.publicGoal}`).join(". ");
  return [
    `${item.title}. ${item.situation}`,
    `Центральный конфликт: ${item.conflict}. Участники: ${all}.`,
    `Ставки: ${list(item.stakes)}. У вашей роли есть ограничения: ${list(role.constraints)}.`,
    `Вы играете роль ${role.name}, ${role.position}. Ваша цель: ${role.publicGoal}. Ваши интересы: ${list(role.interests)}. Начальная ситуация: ${item.startSituation}`,
  ][index];
}

export async function generateCaseMedia(caseId: string) {
  const db = getSupabaseAdmin();
  const { data: generationId, error: claimError } = await db.rpc("claim_case_media_job", { p_case_id: caseId, p_force: false });
  if (claimError) throw new Error(`Запуск медиаконвейера: ${claimError.message}`);
  if (!generationId) return;
  const generatedPaths: string[] = [];
  try {
    const { data, error } = await db.from("negotiation_cases").select("*").eq("id", caseId).single();
    if (error) throw error;
    const item = mapCaseRow(data);
    const roles = rolesOf(item);
    const cast = roles.map((r) => `${r.name}: ${r.position}, ${r.voiceGender === "female" ? "женщина" : "мужчина"}`).join("; ");
    const imagePaths: string[] = [];
    for (let index = 0; index < beats.length; index++) {
      const beat = beats[index];
      const response = await getOpenAI().images.generate({
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
        prompt: `Премиальный европейский графический роман, корпоративный управленческий конфликт, кинематографический широкий кадр 16:9. Кейс: ${item.situation}. Персонажи, сохраняй одинаковую внешность во всех кадрах: ${cast}. Сцена: ${beat.focus}. Тёмно-синяя и голубая палитра KORUS NEGA AI, реалистичные взрослые пропорции, выразительная деловая пластика. Без текста, букв, логотипов, водяных знаков и речевых облаков.`,
        size: "1536x1024",
        quality: "low",
        output_format: "webp",
      });
      const encoded = response.data?.[0]?.b64_json;
      if (!encoded) throw new Error(`Изображение ${index + 1} не создано.`);
      const path = `${caseId}/${generationId}/shared/panel-${index + 1}.webp`;
      const uploaded = await db.storage.from("case-comics").upload(path, Buffer.from(encoded, "base64"), { contentType: "image/webp", upsert: true });
      if (uploaded.error) throw uploaded.error;
      generatedPaths.push(path);
      imagePaths.push(path);
    }
    const rows = [];
    for (let roleIndex = 0; roleIndex < roles.length; roleIndex++) {
      const role = roles[roleIndex];
      for (let panelIndex = 0; panelIndex < beats.length; panelIndex++) {
        const narration = narrationFor(item, role, panelIndex);
        const voice = role.voiceGender === "male" ? "cedar" : "marin";
        const speech = await getOpenAI().audio.speech.create({ model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts", voice, input: narration, instructions: "Говори по-русски естественно и увлекательно, как рассказчик делового комикса. Не добавляй фактов.", response_format: "mp3" });
        const audioPath = `${caseId}/${generationId}/role-${roleIndex}/panel-${panelIndex + 1}-${voice}.mp3`;
        const audioUpload = await db.storage.from("case-comics").upload(audioPath, Buffer.from(await speech.arrayBuffer()), { contentType: "audio/mpeg", upsert: true });
        if (audioUpload.error) throw audioUpload.error;
        generatedPaths.push(audioPath);
        rows.push({ case_id: caseId, generation_id: generationId, role_index: roleIndex, panel_index: panelIndex, eyebrow: beats[panelIndex].eyebrow, title: panelIndex === 3 ? `Ваша роль — ${role.name}` : beats[panelIndex].title, narration, image_path: imagePaths[panelIndex], audio_path: audioPath });
      }
    }
    const saved = await db.from("case_comic_panels").insert(rows);
    if (saved.error) throw saved.error;
    const { data: completed, error: completeError } = await db.rpc("complete_case_media_job", { p_case_id: caseId, p_generation_id: generationId });
    if (completeError || !completed) throw new Error(completeError?.message || "Попытка медиаконвейера устарела.");

    const { data: obsoleteRows } = await db.from("case_comic_panels").select("id,generation_id,image_path,audio_path").eq("case_id", caseId);
    const obsolete = (obsoleteRows || []).filter((row) => row.generation_id !== generationId);
    if (obsolete.length) {
      await db.from("case_comic_panels").delete().in("id", obsolete.map((row) => row.id));
      const obsoletePaths = [...new Set(obsolete.flatMap((row) => [row.image_path, row.audio_path]).filter(Boolean))];
      if (obsoletePaths.length) await db.storage.from("case-comics").remove(obsoletePaths);
    }
  } catch (error) {
    await db.from("case_comic_panels").delete().eq("case_id", caseId).eq("generation_id", generationId);
    if (generatedPaths.length) await db.storage.from("case-comics").remove(generatedPaths);
    await db.from("case_media_jobs").update({ status: "failed", error: error instanceof Error ? error.message.slice(0, 1000) : "Ошибка медиаконвейера", updated_at: new Date().toISOString() }).eq("case_id", caseId).eq("generation_id", generationId);
    throw error;
  }
}
