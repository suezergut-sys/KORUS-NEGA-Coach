# KORUS NEGA AI Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the screenshot-driven ten-screen onboarding with a seven-screen card-based introduction that explains the platform, prepares the user for a first negotiation, and reuses the product’s actual brand and section icons.

**Architecture:** Keep `OnboardingModal` as the client-side controller, move static screen content and storage helpers into `src/lib/onboarding.ts`, render one screen through a focused `OnboardingCard` component, and extract the logo and navigation icons into shared components used by both the product shell and onboarding. The onboarding remains network-free and stores only its versioned completion marker in `localStorage`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, CSS in `src/app/globals.css`, Vitest 4, `react-dom/server` for pure component rendering tests.

## Global Constraints

- The onboarding contains exactly seven screens in this order: welcome, platform capabilities, negotiations, progress, own cases, external analysis, first training.
- Every user-facing onboarding sentence addresses the user only with informal Russian «ты» forms; no polite «вы» address is allowed.
- The platform is positioned as systematic skills practice, preparation for real work negotiations, and a safe and confidential training environment.
- The capabilities screen explicitly says that the current platform works without VPN, is adapted for phones, and needs no additional installation.
- No screenshots or other captures of the product interface may appear in onboarding.
- The product logo must come from one shared component.
- Product section icons shown in onboarding must be the same SVG components used by `AppNavRail`.
- Any product control shown as an example must use the same shared component as the real product; do not draw a local imitation.
- Do not reproduce full product forms in onboarding.
- No visible screen numbers are allowed.
- Progress uses seven non-interactive visual segments or dots; accessible text may announce the current position and total.
- The final action is labeled «Перейти к переговорам» and navigates to `/`.
- The completion key is exactly `korus-nega-onboarding-v3`.
- Preserve first-run auto-open, explicit post-registration open, repeat launch from the account page, Escape close, focus trap, ArrowLeft/ArrowRight navigation, and skip behavior.
- README must describe the shipped behavior in the same change.

---

## File Map

- Create `src/components/AppBrandMark.tsx`: the single reusable KORUS logo component.
- Create `src/components/AppSectionIcon.tsx`: the single reusable SVG icon renderer and `AppSectionIconName` type.
- Create `src/lib/app-section-icons.ts`: the framework-free canonical icon-name list shared by content and React components.
- Create `src/components/OnboardingCard.tsx`: pure renderer for welcome, overview, feature, and final onboarding cards.
- Modify `src/components/AppNavRail.tsx`: replace private logo/icon implementations with the shared components.
- Modify `src/components/OnboardingModal.tsx`: retain modal orchestration and render the new seven-screen card flow.
- Modify `src/lib/onboarding.ts`: hold versioned state helpers, screen types, and the seven-screen static configuration.
- Modify `tests/onboarding.test.ts`: cover versioning, content, screenshot removal, address style, storage failure, and auto-launch rules.
- Create `tests/app-shell-visuals.test.tsx`: verify the shared logo and icon primitives render stable markup.
- Create `tests/onboarding-card.test.tsx`: verify the pure card renderer and non-interactive progress.
- Modify `src/app/globals.css:551-633`: replace old screenshot/welcome styles with the card-based concept and responsive states.
- Modify `README.md:151-156`: document the new onboarding.
- Delete `public/onboarding/account.png`.
- Delete `public/onboarding/case-builder.png`.
- Delete `public/onboarding/external-analysis.png`.
- Delete `public/onboarding/home.png`.
- Delete `public/onboarding/main-interface.png`.
- Delete `public/onboarding/navigation.png`.
- Delete `public/onboarding/quick-upload.png`.
- Delete `public/onboarding/rating.png`.

---

### Task 1: Versioned content model and failure-safe completion state

**Files:**
- Modify: `tests/onboarding.test.ts`
- Create: `src/lib/app-section-icons.ts`
- Modify: `src/lib/onboarding.ts`

**Interfaces:**
- Produces: `AppSectionIconName`, `OnboardingContentIcon`, `OnboardingCapability`, `OnboardingStep`, `ONBOARDING_STEPS`, `ONBOARDING_STORAGE_KEY`, `getOnboardingStorage(source)`, `readOnboardingCompleted(storage)`, `writeOnboardingCompleted(storage)`, and existing `shouldAutoOpenOnboarding(input)`.
- Consumes: no new application interfaces.

- [ ] **Step 1: Extend the onboarding tests so the new contract fails first**

Replace `tests/onboarding.test.ts` with tests that preserve the current launch cases and add the new content/state contract:

```ts
import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY,
  getOnboardingStorage,
  readOnboardingCompleted,
  shouldAutoOpenOnboarding,
  writeOnboardingCompleted,
} from "../src/lib/onboarding";

describe("onboarding content", () => {
  it("uses the v3 completion key and the approved seven-screen order", () => {
    expect(ONBOARDING_STORAGE_KEY).toBe("korus-nega-onboarding-v3");
    expect(ONBOARDING_STEPS.map((step) => step.id)).toEqual([
      "welcome",
      "capabilities",
      "negotiations",
      "progress",
      "cases",
      "analysis",
      "ready",
    ]);
  });

  it("does not depend on interface screenshots", () => {
    expect(JSON.stringify(ONBOARDING_STEPS)).not.toContain("/onboarding/");
    expect(JSON.stringify(ONBOARDING_STEPS)).not.toContain(".png");
  });

  it("uses informal address and includes mobile access without VPN", () => {
    const copy = JSON.stringify(ONBOARDING_STEPS);
    expect(copy).not.toMatch(/(^|[\s«„"])вы([\s»“".,!?:;]|$)/iu);
    expect(copy).toContain("без VPN");
    expect(copy).toContain("телефона");
    expect(copy).toContain("дополнительная установка не требуется");
  });
});

describe("onboarding completion storage", () => {
  it("resolves localStorage without leaking a browser security error", () => {
    const blockedWindow = Object.defineProperty({}, "localStorage", {
      get: () => { throw new Error("blocked"); },
    });
    expect(getOnboardingStorage(blockedWindow)).toBeNull();
  });

  it("reads and writes the completed mark", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    expect(readOnboardingCompleted(storage)).toBe(false);
    expect(writeOnboardingCompleted(storage)).toBe(true);
    expect(readOnboardingCompleted(storage)).toBe(true);
  });

  it("does not throw when browser storage is unavailable", () => {
    const storage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readOnboardingCompleted(storage)).toBe(false);
    expect(writeOnboardingCompleted(storage)).toBe(false);
  });
});

describe("onboarding auto-launch", () => {
  it("opens once for an existing authenticated user without the current completion mark", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/", requested: false, completed: false })).toBe(true);
    expect(shouldAutoOpenOnboarding({ pathname: "/account", requested: false, completed: false })).toBe(true);
  });

  it("stays closed after the current onboarding version is completed", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/", requested: false, completed: true })).toBe(false);
  });

  it("does not cover public or admin entry pages automatically", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/login", requested: false, completed: false })).toBe(false);
    expect(shouldAutoOpenOnboarding({ pathname: "/register", requested: false, completed: false })).toBe(false);
    expect(shouldAutoOpenOnboarding({ pathname: "/admin/login", requested: false, completed: false })).toBe(false);
  });

  it("honors an explicit first-run request after registration", () => {
    expect(shouldAutoOpenOnboarding({ pathname: "/", requested: true, completed: true })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing exports fail**

Run:

```bash
npm test -- tests/onboarding.test.ts
```

Expected: FAIL because `ONBOARDING_STEPS`, `readOnboardingCompleted`, and `writeOnboardingCompleted` do not exist and the key is still v2.

- [ ] **Step 3: Add the typed seven-screen configuration and safe storage helpers**

Create `src/lib/app-section-icons.ts`:

```ts
export const APP_SECTION_ICON_NAMES = [
  "negotiations",
  "account",
  "rating",
  "upload",
  "create",
  "analyze",
  "logout",
  "admin",
  "mobile",
] as const;

export type AppSectionIconName = (typeof APP_SECTION_ICON_NAMES)[number];
export type OnboardingContentIcon = Exclude<AppSectionIconName, "logout" | "admin">;
```

Then implement these public shapes in `src/lib/onboarding.ts`:

```ts
import type { OnboardingContentIcon } from "@/lib/app-section-icons";

export type OnboardingCapability = {
  title: string;
  description: string;
  icon: OnboardingContentIcon;
};

export type OnboardingStep = {
  id: "welcome" | "capabilities" | "negotiations" | "progress" | "cases" | "analysis" | "ready";
  kind: "welcome" | "overview" | "feature" | "final";
  eyebrow: string;
  title: string;
  description: string;
  why?: string;
  actions?: readonly string[];
  highlights?: readonly string[];
  capabilities?: readonly OnboardingCapability[];
  icons: readonly OnboardingContentIcon[];
  footer?: string;
};

export const ONBOARDING_STORAGE_KEY = "korus-nega-onboarding-v3";

type OnboardingStorage = Pick<Storage, "getItem" | "setItem">;

export function getOnboardingStorage(source: { localStorage?: OnboardingStorage } | null | undefined) {
  try {
    return source?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readOnboardingCompleted(storage: OnboardingStorage | null | undefined) {
  try {
    return storage?.getItem(ONBOARDING_STORAGE_KEY) === "completed";
  } catch {
    return false;
  }
}

export function writeOnboardingCompleted(storage: OnboardingStorage | null | undefined) {
  try {
    storage?.setItem(ONBOARDING_STORAGE_KEY, "completed");
    return Boolean(storage);
  } catch {
    return false;
  }
}
```

Define `ONBOARDING_STEPS` with the exact Russian copy approved in `docs/superpowers/specs/2026-07-28-onboarding-redesign-design.md`, including:

- three welcome highlights;
- five structured capabilities with titles, descriptions, shared icon names, and the no-install footer;
- `why` and `actions` for negotiations, progress, cases, and analysis;
- the final three-action route.

Keep `shouldAutoOpenOnboarding` behavior unchanged.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run:

```bash
npm test -- tests/onboarding.test.ts
```

Expected: all onboarding content, storage, and launch tests PASS.

- [ ] **Step 5: Commit the content/state layer**

```bash
git add src/lib/app-section-icons.ts src/lib/onboarding.ts tests/onboarding.test.ts
git commit -m "feat: define onboarding content and state"
```

---

### Task 2: Shared product logo and section icons

**Files:**
- Create: `src/components/AppBrandMark.tsx`
- Create: `src/components/AppSectionIcon.tsx`
- Create: `tests/app-shell-visuals.test.tsx`
- Modify: `src/components/AppNavRail.tsx`

**Interfaces:**
- Consumes: `APP_SECTION_ICON_NAMES` and `AppSectionIconName` from `@/lib/app-section-icons`.
- Produces: `AppBrandMark`, `AppSectionIcon`, and `AppSectionIconName`.

- [ ] **Step 1: Add failing shared-visual tests**

Create `tests/app-shell-visuals.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AppBrandMark from "../src/components/AppBrandMark";
import AppSectionIcon, { APP_SECTION_ICON_NAMES } from "../src/components/AppSectionIcon";

describe("shared application visuals", () => {
  it("renders the canonical KORUS logo source", () => {
    const markup = renderToStaticMarkup(<AppBrandMark />);
    expect(markup).toContain("korus_sign_color.jpg");
    expect(markup).toContain("KORUS Consulting");
  });

  it("exports every icon used by navigation and onboarding", () => {
    expect(APP_SECTION_ICON_NAMES).toEqual([
      "negotiations",
      "account",
      "rating",
      "upload",
      "create",
      "analyze",
      "logout",
      "admin",
      "mobile",
    ]);
    for (const name of APP_SECTION_ICON_NAMES) {
      expect(renderToStaticMarkup(<AppSectionIcon name={name} />)).toContain("<svg");
    }
  });
});
```

- [ ] **Step 2: Run the new test and verify missing modules fail**

Run:

```bash
npm test -- tests/app-shell-visuals.test.tsx
```

Expected: FAIL because the two shared component files do not exist.

- [ ] **Step 3: Extract the canonical brand mark**

Create `src/components/AppBrandMark.tsx` as the only component that references `/korus_sign_color.jpg`:

```tsx
import Image from "next/image";

type AppBrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export default function AppBrandMark({ className = "", priority = false }: AppBrandMarkProps) {
  return (
    <span className={`app-brand-mark ${className}`.trim()}>
      <Image src="/korus_sign_color.jpg" alt="KORUS Consulting" fill sizes="112px" priority={priority} />
    </span>
  );
}
```

The wrapper owns relative positioning and image cropping through `.app-brand-mark`; callers own dimensions.

- [ ] **Step 4: Extract the complete shared icon set**

Create `src/components/AppSectionIcon.tsx` by re-exporting the canonical names and type, then rendering the selected SVG:

```tsx
export { APP_SECTION_ICON_NAMES, type AppSectionIconName } from "@/lib/app-section-icons";
import type { AppSectionIconName } from "@/lib/app-section-icons";

export default function AppSectionIcon({ name }: { name: AppSectionIconName }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{/* exact path switch */}</svg>;
}
```

Move the existing eight path definitions from `AppNavRail.tsx` without changing their `d`, `circle`, fill, stroke, viewBox, or order. Add `mobile` with a neutral phone outline:

```tsx
<><rect x="6.5" y="2.5" width="11" height="19" rx="2" /><path d="M10 18.5h4" /></>
```

- [ ] **Step 5: Refactor `AppNavRail` to consume the shared logo and icons**

Remove its `Image`, `ReactNode` icon wrapper, and private `icons` object. Import:

```tsx
import AppBrandMark from "@/components/AppBrandMark";
import AppSectionIcon, { type AppSectionIconName } from "@/components/AppSectionIcon";
```

Change `RailLink` to receive `icon: AppSectionIconName`, and render `<AppSectionIcon name={icon} />`. Use `<AppBrandMark className="rail-logo-mark" priority />` inside the existing logo link. Preserve all hrefs, labels, active-state rules, upload button behavior, logout form, and admin link.

- [ ] **Step 6: Run shared tests plus typecheck**

Run:

```bash
npm test -- tests/app-shell-visuals.test.tsx
npm run typecheck
```

Expected: PASS. The nav rail has identical SVG path data and behavior.

- [ ] **Step 7: Commit the shared visual primitives**

```bash
git add src/components/AppBrandMark.tsx src/components/AppSectionIcon.tsx src/components/AppNavRail.tsx tests/app-shell-visuals.test.tsx
git commit -m "refactor: share product brand and section icons"
```

---

### Task 3: Pure card renderer for the seven-screen concept

**Files:**
- Create: `src/components/OnboardingCard.tsx`
- Create: `tests/onboarding-card.test.tsx`

**Interfaces:**
- Consumes: `OnboardingStep` from `@/lib/onboarding`, `AppBrandMark`, and `AppSectionIcon`.
- Produces: `OnboardingCard({ step, currentIndex, total })`.

- [ ] **Step 1: Add failing renderer tests**

Create `tests/onboarding-card.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import OnboardingCard from "../src/components/OnboardingCard";
import { ONBOARDING_STEPS } from "../src/lib/onboarding";

describe("OnboardingCard", () => {
  it("renders the welcome value proposition and shared brand", () => {
    const markup = renderToStaticMarkup(
      <OnboardingCard step={ONBOARDING_STEPS[0]} currentIndex={0} total={ONBOARDING_STEPS.length} />,
    );
    expect(markup).toContain("Развивай навыки переговоров через практику");
    expect(markup).toContain("/korus_sign_color.jpg");
    expect(markup).toContain("безопасная и конфиденциальная среда");
  });

  it("renders why and action blocks for a feature", () => {
    const markup = renderToStaticMarkup(
      <OnboardingCard step={ONBOARDING_STEPS[2]} currentIndex={2} total={ONBOARDING_STEPS.length} />,
    );
    expect(markup).toContain("Зачем тебе это");
    expect(markup).toContain("Что делать");
    expect(markup).toContain("выбери кейс и изучи вводные");
  });

  it("renders non-interactive progress without visible numbering", () => {
    const markup = renderToStaticMarkup(
      <OnboardingCard step={ONBOARDING_STEPS[3]} currentIndex={3} total={ONBOARDING_STEPS.length} />,
    );
    expect(markup.match(/onboarding-progress-segment/g)).toHaveLength(7);
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("4 / 7");
    expect(markup).toContain("Экран 4 из 7");
  });
});
```

- [ ] **Step 2: Run the renderer test and verify the module is missing**

Run:

```bash
npm test -- tests/onboarding-card.test.tsx
```

Expected: FAIL because `OnboardingCard` does not exist.

- [ ] **Step 3: Implement the four card variants through one public component**

Create `src/components/OnboardingCard.tsx`. The component must:

- use `<AppBrandMark className="onboarding-brand-mark" priority />` only for `kind === "welcome"`;
- render `step.icons` through `<AppSectionIcon name={icon} />`;
- render the five `step.capabilities` as stable cards with their shared icons for `kind === "overview"`;
- render `why` and an ordered action list for `kind === "feature"`;
- render the final route without an additional internal button for `kind === "final"`;
- render progress as seven `<span className="onboarding-progress-segment">` elements;
- set `data-state="complete" | "current" | "upcoming"` on segments;
- expose `Экран ${currentIndex + 1} из ${total}` as the progress container’s accessible label without rendering a visible number.

Use this skeleton:

```tsx
export default function OnboardingCard({ step, currentIndex, total }: Props) {
  return (
    <div className={`onboarding-card onboarding-card-${step.kind}`}>
      <div className="onboarding-card-visual">{renderVisual(step)}</div>
      <div className="onboarding-card-copy">
        <span className="onboarding-eyebrow">{step.eyebrow}</span>
        <h2 id="onboarding-title">{step.title}</h2>
        <p id="onboarding-description">{step.description}</p>
        {step.why && <section className="onboarding-why"><h3>Зачем тебе это</h3><p>{step.why}</p></section>}
        {step.actions && <section className="onboarding-how"><h3>Что делать</h3><ol>{step.actions.map(/* stable li */)}</ol></section>}
        {step.footer && <p className="onboarding-card-footer">{step.footer}</p>}
      </div>
      <div className="onboarding-progress" aria-label={`Экран ${currentIndex + 1} из ${total}`}>
        {/* non-interactive segments */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run renderer and content tests**

Run:

```bash
npm test -- tests/onboarding-card.test.tsx tests/onboarding.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the card renderer**

```bash
git add src/components/OnboardingCard.tsx tests/onboarding-card.test.tsx
git commit -m "feat: render onboarding capability cards"
```

---

### Task 4: Modal orchestration, navigation, and accessibility

**Files:**
- Modify: `src/components/OnboardingModal.tsx`
- Modify: `tests/onboarding.test.ts`

**Interfaces:**
- Consumes: `ONBOARDING_STEPS`, `readOnboardingCompleted`, `writeOnboardingCompleted`, `shouldAutoOpenOnboarding`, and `OnboardingCard`.
- Produces: the root-layout onboarding modal and existing `ONBOARDING_OPEN_EVENT`.

- [ ] **Step 1: Add failing navigation-boundary helper tests**

Add to `tests/onboarding.test.ts`:

```ts
import { clampOnboardingStep } from "../src/lib/onboarding";

describe("onboarding step navigation", () => {
  it("keeps keyboard navigation inside the seven-screen range", () => {
    expect(clampOnboardingStep(-1, ONBOARDING_STEPS.length)).toBe(0);
    expect(clampOnboardingStep(3, ONBOARDING_STEPS.length)).toBe(3);
    expect(clampOnboardingStep(7, ONBOARDING_STEPS.length)).toBe(6);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the helper is missing**

Run:

```bash
npm test -- tests/onboarding.test.ts
```

Expected: FAIL because `clampOnboardingStep` is not exported.

- [ ] **Step 3: Implement the navigation boundary helper**

Add to `src/lib/onboarding.ts`:

```ts
export function clampOnboardingStep(index: number, total: number) {
  return Math.min(Math.max(index, 0), Math.max(total - 1, 0));
}
```

Run:

```bash
npm test -- tests/onboarding.test.ts
```

Expected: PASS.

- [ ] **Step 4: Replace screenshot rendering with `OnboardingCard`**

In `src/components/OnboardingModal.tsx`:

- remove `next/image`, the local `OnboardingStep` type, the ten-step array, and `StepVisual`;
- import `useRouter` from `next/navigation`;
- import `OnboardingCard`;
- import `ONBOARDING_STEPS`, `clampOnboardingStep`, `getOnboardingStorage`, `readOnboardingCompleted`, and `writeOnboardingCompleted`;
- keep `ONBOARDING_OPEN_EVENT` unchanged;
- use `ONBOARDING_STEPS.length` for all boundaries;
- replace direct `localStorage` access with `getOnboardingStorage(window)` plus the safe read/write helpers;
- keep the query-parameter removal behavior;
- keep body scroll lock and focus trap;
- make Escape call the same completion path as «Пропустить»;
- use ArrowRight/ArrowLeft with `clampOnboardingStep`;
- render `<OnboardingCard step={current} currentIndex={step} total={ONBOARDING_STEPS.length} />`;
- remove the visible counter from the action footer;
- label the final action exactly «Перейти к переговорам»;
- on final action, write completion, close, and call `router.push("/")`;
- ensure the dialog still references `onboarding-title` and `onboarding-description`.

Use separate controller callbacks:

```tsx
const completeAndClose = useCallback(() => {
  writeOnboardingCompleted(getOnboardingStorage(window));
  setOpen(false);
}, []);

const finish = useCallback(() => {
  completeAndClose();
  router.push("/");
}, [completeAndClose, router]);
```

The skip button and Escape call `completeAndClose`; only the final CTA calls `finish`.

- [ ] **Step 5: Run focused tests, lint, and typecheck**

Run:

```bash
npm test -- tests/onboarding.test.ts tests/onboarding-card.test.tsx tests/app-shell-visuals.test.tsx
npm run lint
npm run typecheck
```

Expected: PASS with no unused screenshot imports or inaccessible interactive progress elements.

- [ ] **Step 6: Commit the modal behavior**

```bash
git add src/components/OnboardingModal.tsx src/lib/onboarding.ts tests/onboarding.test.ts
git commit -m "feat: replace onboarding flow"
```

---

### Task 5: Card styling, responsive behavior, asset cleanup, and documentation

**Files:**
- Modify: `src/app/globals.css:551-633`
- Modify: `README.md:151-156`
- Delete: `public/onboarding/account.png`
- Delete: `public/onboarding/case-builder.png`
- Delete: `public/onboarding/external-analysis.png`
- Delete: `public/onboarding/home.png`
- Delete: `public/onboarding/main-interface.png`
- Delete: `public/onboarding/navigation.png`
- Delete: `public/onboarding/quick-upload.png`
- Delete: `public/onboarding/rating.png`

**Interfaces:**
- Consumes: class names emitted by `AppBrandMark`, `OnboardingCard`, and `OnboardingModal`.
- Produces: the final desktop/mobile visual treatment and accurate documentation.

- [ ] **Step 1: Replace old screenshot-specific CSS with the approved card system**

In `src/app/globals.css`, remove rules for:

- `.onboarding-visual`;
- `.onboarding-interface-visual`;
- `.onboarding-screenshot-frame`;
- screenshot-specific variants such as `.navigation`, `.settings`, `.live-session`, `.case-tools`, and `.external-analysis`;
- orbit/pulse welcome artwork;
- interactive `.onboarding-progress button` rules;
- the visible `.onboarding-actions > span` counter.

Add focused rules for:

```css
.app-brand-mark { position: relative; display: block; overflow: hidden; background: #100b38; }
.app-brand-mark img { object-fit: cover; }
.onboarding-dialog { width: min(960px, 100%); }
.onboarding-card { min-height: 620px; display: grid; grid-template-columns: minmax(280px, .82fr) minmax(0, 1.18fr); grid-template-rows: 1fr auto; }
.onboarding-card-visual { display: grid; place-items: center; color: #f4f9ff; background: linear-gradient(145deg, #161432, #231f50); }
.onboarding-card-copy { min-width: 0; overflow-y: auto; padding: 72px 48px 28px; background: #f6f7fb; color: #161432; }
.onboarding-progress { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 7px; padding: 0 48px 24px; background: #f6f7fb; }
.onboarding-progress-segment { height: 4px; border-radius: 999px; background: #d7d9e4; }
.onboarding-progress-segment[data-state="complete"] { background: #8d8ba7; }
.onboarding-progress-segment[data-state="current"] { background: #ff4038; box-shadow: 0 0 10px rgba(255, 64, 56, .35); }
.onboarding-why, .onboarding-how { border-radius: 12px; background: #eceef5; }
.onboarding-capability-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
```

Complete the rules needed for:

- coral `#ff4038` and navy `#161432` branding;
- exact shared SVG styling without changing path data;
- five overview cards, with the final mobile card allowed to span both columns;
- feature icon pairs;
- numbered action instructions;
- existing modal actions and skip control;
- visible `:focus-visible`;
- no horizontal overflow.

- [ ] **Step 2: Add mobile and reduced-motion behavior**

At the existing responsive section, implement:

```css
@media (max-width: 760px) {
  .onboarding-overlay { padding: 10px; }
  .onboarding-dialog { max-height: calc(100dvh - 20px); border-radius: 16px; }
  .onboarding-card { min-height: 0; grid-template-columns: 1fr; grid-template-rows: auto 1fr auto; }
  .onboarding-card-visual { min-height: 150px; padding: 46px 24px 20px; }
  .onboarding-card-copy { padding: 24px 22px 18px; }
  .onboarding-progress { grid-column: 1; padding: 0 22px 16px; }
  .onboarding-capability-grid { grid-template-columns: 1fr; }
  .onboarding-actions { grid-template-columns: minmax(88px, .8fr) minmax(0, 1.2fr); }
}

@media (prefers-reduced-motion: reduce) {
  .onboarding-overlay, .onboarding-dialog { animation: none; }
  .onboarding-progress-segment { transition: none; }
}
```

Keep minimum touch targets of 44px for action controls.

- [ ] **Step 3: Delete screenshot assets only after verifying no references remain**

Run:

```bash
rg -n "/onboarding/|public/onboarding" src tests README.md
```

Expected: no matches.

Delete exactly the eight files listed in this task, then verify:

```bash
git status --short public/onboarding
```

Expected: eight deleted files and no unrelated paths.

- [ ] **Step 4: Update README to describe shipped behavior**

Replace the current screenshot paragraph around `README.md:151-156` with text that states:

- the onboarding has seven card-based screens;
- it explains the platform before preparing the first training;
- it contains no product screenshots;
- logo and section icons are shared with the product shell;
- it explicitly mentions phone access and no VPN requirement;
- it opens once using the v3 key and can be relaunched from the account page;
- it supports skip, Back/Next, arrows, Escape, focus trapping, and responsive mobile layout.

- [ ] **Step 5: Run the full automated checks**

Run:

```bash
npm run check
npm run build
```

Expected: lint, typecheck, all Vitest suites, and the production build PASS.

- [ ] **Step 6: Perform local visual and interaction QA**

Start the application:

```bash
npm run dev
```

Using the authenticated browser session, verify:

- desktop viewport near 1440×900;
- mobile viewport near 390×844;
- all seven screens and exact approved copy;
- no visible screen numbers;
- seven non-interactive progress segments;
- shared logo and section icons match the nav rail;
- Back, Next, ArrowLeft, ArrowRight, Escape, Skip, and focus trap;
- final «Перейти к переговорам» opens `/`;
- no clipped content or horizontal scrolling;
- repeat launch from the account page.

- [ ] **Step 7: Commit styling, cleanup, and docs**

```bash
git add src/app/globals.css README.md public/onboarding
git commit -m "feat: finish responsive onboarding redesign"
```

---

### Task 6: Final review, publication, and production verification

**Files:**
- Review only: all files changed by Tasks 1–5.

**Interfaces:**
- Consumes: the complete onboarding redesign.
- Produces: a review-ready branch, pull request, merged production deployment, and verified live behavior.

- [ ] **Step 1: Review the complete diff against the approved specification**

Run:

```bash
git diff origin/main...HEAD --check
git diff origin/main...HEAD --stat
git status --short --branch
```

Confirm:

- only onboarding, shared shell visuals, tests, assets, README, spec, and plan are changed;
- no screenshot references remain;
- no user-owned unrelated changes are included.

- [ ] **Step 2: Re-run final verification from a clean command**

Run:

```bash
npm run check
npm run build
```

Expected: all checks PASS immediately before publication.

- [ ] **Step 3: Use the repository publication workflow**

Follow the repository `AGENTS.md`:

- push `feat/onboarding-redesign-spec`;
- open a pull request containing only this work;
- wait for required GitHub checks;
- address failures without merging unrelated changes;
- merge to the production branch after checks pass;
- wait for the Vercel production deployment to reach `Ready`.

- [ ] **Step 4: Verify the live production experience**

Open `https://korus-nega-coach.vercel.app` through the Chrome workflow and verify:

- the deployed commit is live;
- the v3 onboarding opens once when its completion mark is absent;
- the seven screens render correctly on desktop and mobile;
- final navigation reaches negotiations;
- repeat launch from the account page works;
- logo and section icons remain identical to the product shell.

- [ ] **Step 5: Record final evidence**

Capture in the final handoff:

- branch, commit, and pull request;
- automated check results;
- Vercel production status;
- desktop and mobile verification outcomes;
- confirmation that README was reviewed and updated.
