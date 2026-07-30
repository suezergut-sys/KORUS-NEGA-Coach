export type ResizablePanel = "settings" | "opponent";

export type PanelWidths = {
  settings: number;
  opponent: number;
};

export const MIN_SETTINGS_PANEL_WIDTH = 290;
export const MIN_OPPONENT_PANEL_WIDTH = 330;
export const MIN_WIDE_CONVERSATION_WIDTH = 520;
export const MIN_COMPACT_CONVERSATION_WIDTH = 460;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function resizePanels({
  panel,
  widths,
  conversationWidth,
  deltaX,
  minimumConversationWidth,
}: {
  panel: ResizablePanel;
  widths: PanelWidths;
  conversationWidth: number;
  deltaX: number;
  minimumConversationWidth: number;
}): PanelWidths {
  const availableGrowth = Math.max(0, conversationWidth - minimumConversationWidth);

  if (panel === "settings") {
    return {
      ...widths,
      settings: clamp(
        widths.settings + deltaX,
        MIN_SETTINGS_PANEL_WIDTH,
        widths.settings + availableGrowth,
      ),
    };
  }

  return {
    ...widths,
    opponent: clamp(
      widths.opponent - deltaX,
      MIN_OPPONENT_PANEL_WIDTH,
      widths.opponent + availableGrowth,
    ),
  };
}

export function fitPanelWidths(widths: PanelWidths, maximumCombinedWidth: number): PanelWidths {
  const minimumCombinedWidth = MIN_SETTINGS_PANEL_WIDTH + MIN_OPPONENT_PANEL_WIDTH;
  const availableExtraWidth = Math.max(0, maximumCombinedWidth - minimumCombinedWidth);
  const settingsExtra = Math.max(0, widths.settings - MIN_SETTINGS_PANEL_WIDTH);
  const opponentExtra = Math.max(0, widths.opponent - MIN_OPPONENT_PANEL_WIDTH);
  const requestedExtraWidth = settingsExtra + opponentExtra;

  if (requestedExtraWidth <= availableExtraWidth) {
    return {
      settings: Math.max(MIN_SETTINGS_PANEL_WIDTH, widths.settings),
      opponent: Math.max(MIN_OPPONENT_PANEL_WIDTH, widths.opponent),
    };
  }

  if (requestedExtraWidth === 0) {
    return {
      settings: MIN_SETTINGS_PANEL_WIDTH,
      opponent: MIN_OPPONENT_PANEL_WIDTH,
    };
  }

  const scale = availableExtraWidth / requestedExtraWidth;
  return {
    settings: MIN_SETTINGS_PANEL_WIDTH + settingsExtra * scale,
    opponent: MIN_OPPONENT_PANEL_WIDTH + opponentExtra * scale,
  };
}
