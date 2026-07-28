# Onboarding Layout Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать левую синюю область онбординга цельной, выровнять кнопку «Назад» по правой колонке и зафиксировать одинаковые размеры всех семи карточек на десктопе и мобильном устройстве.

**Architecture:** Вся модальная карточка использует одну CSS Grid-разметку. `OnboardingCard` становится прозрачной для раскладки через `display: contents`: визуальная область занимает левую колонку и все строки, а текст, прогресс и действия последовательно размещаются справа. На мобильном те же элементы переходят в четыре фиксированные строки, а текстовая область получает внутреннюю прокрутку.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Grid, Vitest.

## Global Constraints

- Не менять тексты, порядок семи шагов, маршруты и поведение кнопок.
- Не добавлять скриншоты интерфейса или новые зависимости.
- Синяя область должна быть непрерывной на каждом десктопном шаге.
- Внешние размеры диалога не должны меняться при переключении шагов.
- На мобильном длинный текст прокручивается внутри карточки; прогресс и кнопки остаются видимыми.
- Работать в текущей ветке без отдельного worktree и без subagent-делегирования.

---

### Task 1: Единая сетка и стабильные размеры

**Files:**
- Create: `tests/onboarding-layout.test.ts`
- Modify: `src/app/globals.css:559-670`

**Interfaces:**
- Consumes: существующие классы `.onboarding-dialog`, `.onboarding-card`, `.onboarding-card-visual`, `.onboarding-card-copy`, `.onboarding-progress`, `.onboarding-actions`.
- Produces: единый CSS Grid-контракт без изменений React API.

- [ ] **Step 1: Write the failing layout contract test**

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");

describe("onboarding layout", () => {
  it("uses one desktop grid with a continuous visual column", () => {
    expect(css).toMatch(/\.onboarding-dialog\s*\{[^}]*height:\s*min\(680px,\s*calc\(100dvh - 48px\)\)/s);
    expect(css).toMatch(/\.onboarding-dialog\s*\{[^}]*grid-template-columns:\s*minmax\(280px,\s*\.82fr\)\s+minmax\(0,\s*1\.18fr\)/s);
    expect(css).toMatch(/\.onboarding-card\s*\{[^}]*display:\s*contents/s);
    expect(css).toMatch(/\.onboarding-card-visual\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1\s*\/\s*-1/s);
    expect(css).toMatch(/\.onboarding-actions\s*\{[^}]*grid-column:\s*2/s);
    expect(css).not.toContain("linear-gradient(to right, #1d1a42 0 37.3%");
  });

  it("keeps every mobile step at the same available viewport height", () => {
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.onboarding-dialog\s*\{[^}]*height:\s*calc\(100dvh - 20px\)/);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.onboarding-card-visual\s*\{[^}]*grid-row:\s*1/s);
    expect(css).toMatch(/@media \(max-width: 760px\)[\s\S]*?\.onboarding-actions\s*\{[^}]*grid-row:\s*4/s);
  });
});
```

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```powershell
npm.cmd test -- tests/onboarding-layout.test.ts
```

Expected: FAIL because the current dialog has only `min-height`, `OnboardingCard` owns a separate grid, the visual column stops above the footer, and the footer still uses the `37.3%` gradient.

- [ ] **Step 3: Implement the desktop grid**

Update the card rules in `src/app/globals.css` to this layout contract:

```css
.onboarding-dialog {
  width: min(960px, 100%);
  height: min(680px, calc(100dvh - 48px));
  min-height: 0;
  max-height: none;
  display: grid;
  grid-template-columns: minmax(280px, .82fr) minmax(0, 1.18fr);
  grid-template-rows: minmax(0, 1fr) auto auto;
}
.onboarding-card { display: contents; }
.onboarding-card-visual {
  grid-column: 1;
  grid-row: 1 / -1;
}
.onboarding-card-copy {
  grid-column: 2;
  grid-row: 1;
}
.onboarding-progress {
  grid-column: 2;
  grid-row: 2;
}
.onboarding-actions {
  grid-column: 2;
  grid-row: 3;
  padding: 0 48px 26px;
  background: #f6f7fb;
}
```

Keep all existing visual styling that is not part of the layout contract. Remove the old hard-coded footer gradient and `calc(37.3% + 48px)` padding.

- [ ] **Step 4: Implement the mobile grid**

Inside `@media (max-width: 760px)`, override the shared grid:

```css
.onboarding-dialog {
  width: 100%;
  height: calc(100dvh - 20px);
  min-height: 0;
  max-height: none;
  grid-template-columns: 1fr;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
}
.onboarding-card-visual {
  grid-column: 1;
  grid-row: 1;
}
.onboarding-card-copy {
  grid-column: 1;
  grid-row: 2;
}
.onboarding-progress {
  grid-column: 1;
  grid-row: 3;
}
.onboarding-actions {
  grid-column: 1;
  grid-row: 4;
}
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- tests/onboarding-layout.test.ts tests/onboarding-card.test.tsx
```

Expected: both files pass.

- [ ] **Step 6: Commit the implementation**

```powershell
git add -- src/app/globals.css tests/onboarding-layout.test.ts
git commit -m "fix: stabilize onboarding card layout"
```

### Task 2: Documentation and full verification

**Files:**
- Modify: `README.md:156`

**Interfaces:**
- Consumes: stable layout from Task 1.
- Produces: documentation matching the actual responsive behavior.

- [ ] **Step 1: Update README**

Extend the onboarding paragraph to state that all steps keep one stable outer size, the desktop visual column is continuous, and only the text area scrolls when required.

- [ ] **Step 2: Run the complete automated verification**

Run:

```powershell
npm.cmd run check
npm.cmd run build
```

Expected: lint, TypeScript, all Vitest tests, and the Next.js production build pass.

- [ ] **Step 3: Verify all seven desktop steps**

At `1440×900`, open `/?onboarding=1`, record the dialog bounding box for each step, and verify:

```text
width and height are identical for steps 1–7
visual.x and visual.width are identical for steps 1–7
visual bottom equals dialog bottom
copy left equals progress left equals actions left
document scrollWidth equals document clientWidth
```

Also inspect screenshots of the welcome, capabilities, feature, and final cards.

- [ ] **Step 4: Verify all seven mobile steps**

At `390×844`, repeat the bounding-box comparison and verify:

```text
width and height are identical for steps 1–7
visual height is identical for steps 1–7
progress and actions remain visible
copy scrollHeight may exceed copy clientHeight without changing the dialog size
document scrollWidth equals document clientWidth
```

- [ ] **Step 5: Check browser errors**

Read console errors after traversing all steps. Expected: empty error list.

- [ ] **Step 6: Commit documentation**

```powershell
git add -- README.md
git commit -m "docs: describe stable onboarding layout"
```

- [ ] **Step 7: Publish**

Push `fix/onboarding-layout-stability`, open a PR to `main`, wait for GitHub Actions and Vercel Preview, merge after successful checks, wait for production Vercel status `Ready`, then confirm the corrected geometry on `https://korus-nega-coach.vercel.app/?onboarding=1` in Chrome.
