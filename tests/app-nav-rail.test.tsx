import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/rating" }));

import AppNavRail from "../src/components/AppNavRail";

describe("AppNavRail", () => {
  it("renders an accessible desktop expansion control and visible label content", () => {
    const markup = renderToStaticMarkup(<AppNavRail isAdministrator />);

    expect(markup).toContain('aria-label="Развернуть панель навигации"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('<span class="rail-label">Переговоры</span>');
    expect(markup).toContain('<span class="rail-label">Админ-панель</span>');
    expect(markup).toContain('rail-button active');
  });
});
