import { describe, expect, it } from "vitest";

import { routeCategory } from "./clientObservability";

describe("routeCategory", () => {
  it("removes game identifiers from reported routes", () => {
    expect(routeCategory("/play/023c5d93-2a9f-42a3-a6c3-7d2d12411a66")).toBe("/play/:gameId");
    expect(routeCategory("/history/023c5d93-2a9f-42a3-a6c3-7d2d12411a66")).toBe("/history/:gameId");
  });

  it("keeps known static routes and groups unknown paths", () => {
    expect(routeCategory("/about")).toBe("/about");
    expect(routeCategory("/not-a-page")).toBe("other");
  });
});
