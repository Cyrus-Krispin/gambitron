import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("starts, plays, and reloads an active game", async ({ page }) => {
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
  await page.getByRole("button", { name: "♙ White" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();

  const board = page.getByRole("grid", { name: "Chess board" });
  await expect(board).toBeVisible();
  await expect(page.locator("[role='gridcell'][tabindex='0']")).toHaveCount(1);

  const e2 = page.getByRole("gridcell", { name: /^e2, white pawn/ });
  await e2.focus();
  await e2.press("ArrowUp");
  const e3 = page.getByRole("gridcell", { name: /^e3, empty/ });
  await expect(e3).toBeFocused();
  await e3.press("ArrowDown");
  await expect(e2).toBeFocused();

  await e2.press("Enter");
  await e2.press("ArrowUp");
  await page.getByRole("gridcell", { name: /^e3, empty, legal move/ }).press("ArrowUp");
  await page.getByRole("gridcell", { name: /^e4, empty, legal move/ }).press("Enter");

  await expect(page.locator(".move-list .mv").nth(1)).not.toHaveText("", { timeout: 8_000 });
  await expect(page.getByRole("gridcell", { name: /^e4, white pawn/ })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBe(0);

  await page.reload();
  await expect(page.getByRole("gridcell", { name: /^e4, white pawn/ })).toBeVisible();
  await expect(page.locator(".move-list .mv").nth(1)).not.toHaveText("");
});

test("renders a useful not-found page", async ({ page }) => {
  await page.goto("/definitely-missing");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a game" })).toHaveAttribute("href", "/");
});

test("starts as black without duplicating the opening move after reload", async ({ page }) => {
  await page.getByRole("button", { name: "♟ Black" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();

  const whiteMove = page.locator(".move-list .mv").nth(0);
  const blackMove = page.locator(".move-list .mv").nth(1);
  await expect(whiteMove).not.toHaveText("", { timeout: 8_000 });
  await expect(blackMove).toHaveText("");
  await expect(page).toHaveURL(/\/play\/(?!new)[^/?]+$/);

  const opening = await whiteMove.textContent();
  await page.reload();
  await expect(whiteMove).toHaveText(opening ?? "");
  await expect(blackMove).toHaveText("");
});

test("opens a saved game replay and steps through moves", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem("gambitron.localGames.v1", JSON.stringify([{
      id: "saved-smoke-game",
      created_at: "2026-08-24T00:00:00.000Z",
      time_control_ms: 300000,
      result: "1-0",
      termination: "checkmate",
      player_color: "white",
      moves: [{
        ply: 1,
        fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
        san: "e4",
        from_square: "e2",
        to_square: "e4",
        color: "w",
      }],
    }]));
  });
  await page.goto("/history/saved-smoke-game");

  await expect(page.getByRole("heading", { level: 1, name: "Replay game against Gambitron" })).toBeAttached();
  await page.getByRole("button", { name: "Next move" }).click();
  await expect(page.getByRole("gridcell", { name: /^e4, white pawn/ })).toBeVisible();
  await expect(page.getByRole("status", { name: "" })).toContainText("1 / 1");
});
