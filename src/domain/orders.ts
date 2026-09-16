/**
 * Order state machine (CLAUDE.md §20, §21).
 *
 * A controlled set of states and allowed transitions — never arbitrary strings
 * scattered through the app. Every transition is validated; illegal ones throw.
 */

export const ORDER_STATES = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "ARTWORK_PROCESSING",
  "ARTWORK_REVIEW",
  "PRINT_READY",
  "IN_PRODUCTION",
  "PACKED",
  "READY_FOR_COLLECTION",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
  "FAILED",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

/** Allowed forward transitions. Terminal states map to an empty set. */
const TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID", "FAILED", "CANCELLED"],
  PAID: ["ARTWORK_PROCESSING", "REFUND_PENDING", "CANCELLED"],
  ARTWORK_PROCESSING: ["ARTWORK_REVIEW", "PRINT_READY", "FAILED"],
  ARTWORK_REVIEW: ["PRINT_READY", "ARTWORK_PROCESSING", "CANCELLED"],
  PRINT_READY: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["PACKED", "FAILED"],
  PACKED: ["READY_FOR_COLLECTION", "SHIPPED"],
  READY_FOR_COLLECTION: ["DELIVERED", "REFUND_PENDING"],
  SHIPPED: ["DELIVERED", "REFUND_PENDING"],
  DELIVERED: ["REFUND_PENDING"],
  REFUND_PENDING: ["REFUNDED", "PAID"],
  REFUNDED: [],
  CANCELLED: [],
  FAILED: ["PENDING_PAYMENT", "CANCELLED"],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: OrderState): readonly OrderState[] {
  return TRANSITIONS[from];
}

export function isTerminal(state: OrderState): boolean {
  return TRANSITIONS[state].length === 0;
}

export class InvalidTransitionError extends Error {
  constructor(
    public readonly from: OrderState,
    public readonly to: OrderState,
  ) {
    super(`Illegal order transition ${from} → ${to}`);
    this.name = "InvalidTransitionError";
  }
}

/** Validate a transition, throwing {@link InvalidTransitionError} if illegal. */
export function assertTransition(from: OrderState, to: OrderState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** States in which the order (and its production artwork) is frozen (§21). */
export function isFrozen(state: OrderState): boolean {
  return (
    state !== "DRAFT" &&
    state !== "PENDING_PAYMENT" &&
    state !== "CANCELLED" &&
    state !== "FAILED"
  );
}

/** Customer-facing label for a state. */
export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting payment",
  PAID: "Paid",
  ARTWORK_PROCESSING: "Preparing your artwork",
  ARTWORK_REVIEW: "Artwork under review",
  PRINT_READY: "Print ready",
  IN_PRODUCTION: "In production",
  PACKED: "Packed",
  READY_FOR_COLLECTION: "Ready for collection",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  FAILED: "Failed",
};
