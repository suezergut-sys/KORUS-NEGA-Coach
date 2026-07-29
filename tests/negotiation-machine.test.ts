import { describe, expect, it } from "vitest";
import {
  initialNegotiationState,
  negotiationMachineReducer,
  type NegotiationMachineEvent,
} from "../src/lib/negotiation-machine";

function run(events: NegotiationMachineEvent[]) {
  return events.reduce(negotiationMachineReducer, initialNegotiationState);
}

describe("negotiation state machine", () => {
  it("follows the complete lifecycle", () => {
    expect(run([
      { type: "START" },
      { type: "CONNECTED" },
      { type: "PAUSE" },
      { type: "RESUME" },
      { type: "END" },
      { type: "ANALYZE" },
      { type: "COMPLETE" },
    ]).phase).toBe("complete");
  });

  it("keeps a disconnected negotiation live and marks it degraded", () => {
    expect(run([
      { type: "START" },
      { type: "CONNECTED" },
      { type: "CONNECTION_DEGRADED" },
    ])).toEqual({ phase: "live", connectionDegraded: true });
  });

  it("ignores invalid transitions", () => {
    expect(run([{ type: "PAUSE" }, { type: "ANALYZE" }])).toEqual(initialNegotiationState);
  });
});
