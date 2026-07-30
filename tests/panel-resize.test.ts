import { describe, expect, it } from "vitest";
import {
  fitPanelWidths,
  MIN_OPPONENT_PANEL_WIDTH,
  MIN_SETTINGS_PANEL_WIDTH,
  resizePanels,
} from "../src/lib/panel-resize";

describe("изменение ширины панелей переговоров", () => {
  it("расширяет настройки за счёт центральной панели", () => {
    expect(resizePanels({
      panel: "settings",
      widths: { settings: 355, opponent: 395 },
      conversationWidth: 700,
      deltaX: 120,
      minimumConversationWidth: 520,
    })).toEqual({ settings: 475, opponent: 395 });
  });

  it("расширяет панель кейса при движении разделителя влево", () => {
    expect(resizePanels({
      panel: "opponent",
      widths: { settings: 355, opponent: 395 },
      conversationWidth: 700,
      deltaX: -140,
      minimumConversationWidth: 520,
    })).toEqual({ settings: 355, opponent: 535 });
  });

  it("не позволяет панелям и области переговоров стать уже безопасного минимума", () => {
    const narrowedSettings = resizePanels({
      panel: "settings",
      widths: { settings: 355, opponent: 395 },
      conversationWidth: 560,
      deltaX: -500,
      minimumConversationWidth: 520,
    });
    const expandedOpponent = resizePanels({
      panel: "opponent",
      widths: { settings: 355, opponent: 395 },
      conversationWidth: 560,
      deltaX: -500,
      minimumConversationWidth: 520,
    });

    expect(narrowedSettings.settings).toBe(MIN_SETTINGS_PANEL_WIDTH);
    expect(expandedOpponent.opponent).toBe(435);
  });

  it("ужимает сохранённые размеры пропорционально при уменьшении окна", () => {
    const fitted = fitPanelWidths({ settings: 500, opponent: 600 }, 700);

    expect(fitted.settings + fitted.opponent).toBeCloseTo(700);
    expect(fitted.settings).toBeGreaterThanOrEqual(MIN_SETTINGS_PANEL_WIDTH);
    expect(fitted.opponent).toBeGreaterThanOrEqual(MIN_OPPONENT_PANEL_WIDTH);
  });
});
