import { describe, expect, it } from "vitest";
import { buildFlowConsolePath } from "./build-flow-console-path";

describe("buildFlowConsolePath", () => {
  it("returns base route when no params are provided", () => {
    expect(buildFlowConsolePath()).toBe("/settings/flow-console");
  });

  it("preserves URLSearchParams values", () => {
    const params = new URLSearchParams();
    params.set("runId", "run-123");
    params.set("status", "failed");

    expect(buildFlowConsolePath(params)).toBe(
      "/settings/flow-console?runId=run-123&status=failed"
    );
  });

  it("supports record values including string arrays", () => {
    expect(
      buildFlowConsolePath({
        mode: "council",
        runId: ["run-1", "run-2"],
        status: undefined,
      })
    ).toBe("/settings/flow-console?mode=council&runId=run-1&runId=run-2");
  });
});
