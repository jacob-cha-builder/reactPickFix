import { expect, type Locator, type Page } from "@playwright/test";

export async function expectFirstCommentMarkerAligned(page: Page): Promise<void> {
  await expect.poll(async () => {
    const offset = await markerOffset(page);
    return Math.abs(offset.dx) <= 0.5 && Math.abs(offset.dy) <= 0.5;
  }).toBe(true);
}

async function markerOffset(page: Page): Promise<{ readonly dx: number; readonly dy: number }> {
  return page.evaluate(() => {
    const target = document.querySelector("[data-testid='function-component']");
    const marker = document.querySelector("[data-pickfix-comment-marker]");
    if (!(target instanceof HTMLElement) || !(marker instanceof HTMLElement)) {
      throw new Error("Expected function component and first comment marker to exist");
    }
    const targetBox = target.getBoundingClientRect();
    const markerBox = marker.getBoundingClientRect();
    return {
      dx: Math.round(markerBox.left - targetBox.left),
      dy: Math.round(markerBox.top - targetBox.top),
    };
  });
}

export async function computedFontSize(locator: Locator): Promise<number> {
  return locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected an HTML element");
    }
    return Number.parseFloat(getComputedStyle(element).fontSize);
  });
}

export async function inlineFontSize(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected an HTML element");
    }
    return element.style.fontSize;
  });
}

export async function inlineTransform(locator: Locator): Promise<string> {
  return locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error("Expected an HTML element");
    }
    return element.style.transform;
  });
}

export function requireRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) {
    throw new Error("Expected a JSON object");
  }

  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type MutableJsonObject = {
  [key: string]: unknown;
};

export function requireMutableRecord(value: unknown): MutableJsonObject {
  if (!isMutableRecord(value)) {
    throw new Error("Expected a mutable JSON object");
  }

  return value;
}

function isMutableRecord(value: unknown): value is MutableJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
