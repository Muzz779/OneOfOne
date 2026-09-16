import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  isFrozen,
  isTerminal,
} from "./orders";

describe("order state machine", () => {
  it("allows the happy-path lifecycle", () => {
    expect(canTransition("DRAFT", "PENDING_PAYMENT")).toBe(true);
    expect(canTransition("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransition("PAID", "ARTWORK_PROCESSING")).toBe(true);
    expect(canTransition("ARTWORK_PROCESSING", "PRINT_READY")).toBe(true);
    expect(canTransition("PRINT_READY", "IN_PRODUCTION")).toBe(true);
    expect(canTransition("IN_PRODUCTION", "PACKED")).toBe(true);
    expect(canTransition("PACKED", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("DRAFT", "PAID")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "SHIPPED")).toBe(false);
    expect(canTransition("DELIVERED", "IN_PRODUCTION")).toBe(false);
  });

  it("throws InvalidTransitionError on assert of an illegal move", () => {
    expect(() => assertTransition("DRAFT", "PAID")).toThrow(InvalidTransitionError);
  });

  it("marks terminal states", () => {
    expect(isTerminal("REFUNDED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("PAID")).toBe(false);
  });

  it("freezes the order (and artwork) once paid", () => {
    expect(isFrozen("DRAFT")).toBe(false);
    expect(isFrozen("PENDING_PAYMENT")).toBe(false);
    expect(isFrozen("PAID")).toBe(true);
    expect(isFrozen("IN_PRODUCTION")).toBe(true);
  });
});
