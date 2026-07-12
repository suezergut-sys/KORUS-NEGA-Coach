import type { CanonicalCase } from "@/lib/case-types";

export type ComicPanel = { image: string; eyebrow: string; title: string; narration: string };

export function getCaseComic(negotiationCase: CanonicalCase): ComicPanel[] {
  if (negotiationCase.slug !== "missed-project-deadline") return [];
  return [
    {
      image: "/case-comics/missed-project-deadline/01-crisis.png",
      eyebrow: "ЗАВЯЗКА",
      title: "Ключевой этап проекта сорван",
      narration: "Компания «Альтаир» внедряет новую CRM. Ключевой этап проекта сорван. Заказчик требует назвать ответственного, компенсировать задержку и немедленно восстановить управляемость проекта.",
    },
    {
      image: "/case-comics/missed-project-deadline/02-confrontation.png",
      eyebrow: "КОНФЛИКТ",
      title: "Ответственность или системный сбой?",
      narration: "Руководитель проекта должен добиться принятия ответственности и реалистичного плана исправления. Алексей, руководитель отдела продаж, отвергает персональное обвинение и настаивает: проблема носит системный характер.",
    },
    {
      image: "/case-comics/missed-project-deadline/03-interests.png",
      eyebrow: "СТАВКИ СТОРОН",
      title: "Простого решения нет",
      narration: "Руководителю важно вернуть проект в срок, сохранить доверие заказчика и не потерять ключевого специалиста. Алексею важно защитить репутацию, получить ресурсы и не согласиться на невыполнимые обязательства. Давление может усугубить срыв, но уход от ответственности также неприемлем.",
    },
    {
      image: "/case-comics/missed-project-deadline/04-duel.png",
      eyebrow: "ВАШ ХОД",
      title: "Переговоры начинаются сейчас",
      narration: "Стороны остаются один на один. Оппонент начинает с отрицания личной ответственности и требует признать системный характер проблемы. Ваша задача — провести управленческий поединок и изменить расстановку сил в свою пользу.",
    },
  ];
}
