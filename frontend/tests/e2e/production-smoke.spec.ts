import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("starts, plays, and reloads an active game", async ({ page }) => {
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(3);
  const whiteSide = page.getByRole("button", { name: "♙ White" });
  await whiteSide.click();
  await expect(whiteSide).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Play", exact: true }).click();

  const board = page.getByRole("grid", { name: "Chess board" });
  await expect(board).toBeVisible();
  await expect(page.getByRole("timer", { name: /^Gambitron clock:/ })).toBeVisible();
  await expect(page.getByRole("timer", { name: /^Your clock:/ })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Your turn");
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

test("paints the player's first calculated move before the AI reply", async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.reload();
  await page.getByRole("button", { name: "♙ White" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();

  const playBookMove = async (from: RegExp, to: RegExp, aiMoveIndex: number) => {
    await page.getByRole("gridcell", { name: from }).click();
    await page.getByRole("gridcell", { name: to }).click();
    await expect(page.locator(".move-list .mv").nth(aiMoveIndex)).not.toHaveText("");
  };

  await playBookMove(/^e2, white pawn/, /^e4, empty, legal move/, 1);
  await playBookMove(/^g1, white knight/, /^f3, empty, legal move/, 3);
  await playBookMove(/^f1, white bishop/, /^b5, empty, legal move/, 5);
  await playBookMove(/^e1, white king/, /^g1, empty, legal move/, 7);

  await page.getByRole("gridcell", { name: /^d2, white pawn/ }).click();
  const stateAfterPaint = await page.evaluate(async () => {
    const target = document.querySelector<HTMLButtonElement>(
      '[aria-label^="d3, empty, legal move"]',
    );
    target?.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const moves = Array.from(document.querySelectorAll(".move-list .mv"));
    return {
      playerPiecePainted: Boolean(document.querySelector('[aria-label^="d3, white pawn"]')),
      playerMove: moves[8]?.textContent?.trim(),
      aiMove: moves[9]?.textContent?.trim(),
    };
  });

  expect(stateAfterPaint).toEqual({
    playerPiecePainted: true,
    playerMove: "d3",
    aiMove: "",
  });
});

test("renders a useful not-found page", async ({ page }) => {
  await page.goto("/definitely-missing");
  await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start a game" })).toHaveAttribute("href", "/");
});

test("contains focus in the new-game side chooser", async ({ page }) => {
  await page.goto("/play/new");
  await expect(page.getByRole("dialog", { name: "Choose a side" })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Chess board", includeHidden: true })).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator("[role='gridcell']:not(:disabled)")).toHaveCount(0);
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
