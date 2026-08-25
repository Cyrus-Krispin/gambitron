import { describe, expect, it } from "vitest";

import { getKeyboardTarget } from "./boardKeyboard";

describe("getKeyboardTarget", () => {
  it("moves through a white-oriented board", () => {
    expect(getKeyboardTarget("e4", "ArrowUp", "white")).toBe("e5");
    expect(getKeyboardTarget("e4", "ArrowDown", "white")).toBe("e3");
    expect(getKeyboardTarget("e4", "ArrowLeft", "white")).toBe("d4");
    expect(getKeyboardTarget("e4", "ArrowRight", "white")).toBe("f4");
  });

  it("follows the visual direction of a black-oriented board", () => {
    expect(getKeyboardTarget("e4", "ArrowUp", "black")).toBe("e3");
    expect(getKeyboardTarget("e4", "ArrowDown", "black")).toBe("e5");
    expect(getKeyboardTarget("e4", "ArrowLeft", "black")).toBe("f4");
    expect(getKeyboardTarget("e4", "ArrowRight", "black")).toBe("d4");
  });

  it("does not wrap at an edge", () => {
    expect(getKeyboardTarget("a8", "ArrowUp", "white")).toBe("a8");
    expect(getKeyboardTarget("a8", "ArrowLeft", "white")).toBe("a8");
  });
});
