/**
 * Options Page — Structural Snapshot Test
 *
 * Catches unintended UI drift across web and Chrome extension environments.
 * If the snapshot changes, review the diff and update with `vitest -u`.
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { flushEffects } from "@/test/support";

/* ── Mock hooks before importing the component ──────────────────── */

vi.mock("@/hooks/use-projects-scripts", () => ({
  useProjects: () => ({
    projects: [
      {
        id: "proj-1",
        schemaVersion: 1,
        name: "Lovable Dashboard",
        version: "1.2.0",
        description: "Automation scripts for the Lovable dashboard",
        targetUrls: [{ pattern: "lovable.dev/*", matchType: "glob" }],
        scripts: [{ path: "macro-looping.js", order: 1 }],
        configs: [],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-03-18T00:00:00Z",
      },
    ],
    loading: false,
    refresh: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }),
  useScripts: () => ({
    scripts: [
      { id: "s1", name: "macro-looping.js", code: "", order: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-03-18T00:00:00Z" },
    ],
    loading: false,
    refresh: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }),
  useConfigs: () => ({
    configs: [],
    loading: false,
    refresh: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-onboarding", () => ({
  useOnboarding: () => ({
    isComplete: true,
    loading: false,
    completeOnboarding: vi.fn(),
  }),
}));

vi.mock("@/lib/message-client", () => ({
  sendMessage: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/platform", () => ({
  getPlatform: () => ({
    sendMessage: vi.fn().mockResolvedValue({}),
    tabs: { openUrl: vi.fn(), getActiveTabId: vi.fn().mockResolvedValue(1) },
    getExtensionUrl: (p: string) => p,
    storage: { get: vi.fn(), set: vi.fn() },
  }),
}));



import OptionsPage from "@/pages/Options";

const getText = (element: Element | null): string =>
  element?.textContent?.replace(/\s+/g, " ").trim() ?? "";

const getAttribute = (element: Element | null, name: string): string =>
  element?.getAttribute(name) ?? "";

const getTexts = (elements: NodeListOf<Element>): string[] =>
  Array.from(elements).map(getText).filter(Boolean);

const getMenuItems = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-sidebar='menu-button']")).map((button) => ({
    label: getAttribute(button, "aria-label"),
    section: getAttribute(button, "data-section"),
  }));

const getOptionsStructure = (container: HTMLElement) => {
  const marker = container.querySelector("[data-testid='options-state-marker']");

  return {
    state: {
      branch: getAttribute(marker, "data-branch"),
      onboardingComplete: getAttribute(marker, "data-onboarding-complete"),
      projectsLoading: getAttribute(marker, "data-projects-loading"),
    },
    floatingController: {
      mode: getAttribute(container.querySelector("[data-testid='floating-controller-compact']"), "data-mode"),
      phase: getText(container.querySelector("[data-testid='controller-primary']")),
    },
    sidebar: getMenuItems(container),
    header: {
      title: getText(container.querySelector("header h1")),
      workspace: getText(container.querySelector("header [role='combobox'] span")),
      recorderActions: getTexts(container.querySelectorAll("[data-testid='recorder-control-bar'] button")),
    },
    content: {
      heading: getText(container.querySelector("main h2")),
      projectNames: getTexts(container.querySelectorAll("main h3")),
      actionButtons: getTexts(container.querySelectorAll("main button")),
    },
  };
};

describe("Options Page — Structural Snapshot", () => {
  it("matches the baseline snapshot", async () => {
    const { container } = render(<OptionsPage />);
    await flushEffects();
    expect(getOptionsStructure(container)).toMatchSnapshot();
  });
});
