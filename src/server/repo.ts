/**
 * Persistence repository (CLAUDE.md §38, §40, §52).
 *
 * The app depends only on the {@link Repo} interface. The dev implementation is
 * in-memory with JSON-file durability (`.data/db.json`) so autosave/resume (§12)
 * and admin data survive restarts. The production target is Supabase/Postgres:
 * writing one `SupabaseRepo` adapter replaces this with no call-site changes.
 *
 * Asset BINARIES live in the storage service (§37); the repo stores only
 * metadata, keeping the JSON small.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  AdminUser,
  Cart,
  Design,
  DesignAsset,
  InventoryRecord,
  Notification,
  Order,
  Payment,
  PreflightResultRecord,
  ProductionAsset,
  ProductionJob,
  Refund,
  Shipment,
} from "@/domain/entities";
import { variantKey } from "@/domain/entities";
import type { AnalyticsEvent } from "@/domain/analytics";
import {
  DEFAULT_PRICING_CONFIG,
  type PricingConfig,
} from "@/domain/pricing";
import { SEED_PRODUCTS } from "@/domain/products";
import { newId } from "@/domain/ids";

export interface OrderFilter {
  readonly status?: Order["status"];
  readonly search?: string;
}

export interface Repo {
  // Designs & assets
  createDesign(d: Design): Promise<Design>;
  getDesign(id: string): Promise<Design | undefined>;
  saveDesign(d: Design): Promise<Design>;
  listDesignsByUser(userId: string): Promise<Design[]>;
  addAsset(a: DesignAsset): Promise<DesignAsset>;
  getAsset(id: string): Promise<DesignAsset | undefined>;
  listAssetsByDesign(designId: string): Promise<DesignAsset[]>;
  findAssetByHash(hash: string): Promise<DesignAsset | undefined>;

  // Carts
  createCart(cart: Cart): Promise<Cart>;
  getCart(id: string): Promise<Cart | undefined>;
  saveCart(cart: Cart): Promise<Cart>;

  // Orders
  nextOrderSeq(): Promise<number>;
  createOrder(o: Order): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  listOrders(filter?: OrderFilter): Promise<Order[]>;
  saveOrder(o: Order): Promise<Order>;

  // Payments (with webhook idempotency)
  createPayment(p: Payment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByOrder(orderId: string): Promise<Payment | undefined>;
  getPaymentByProviderRef(ref: string): Promise<Payment | undefined>;
  savePayment(p: Payment): Promise<Payment>;
  isEventHandled(eventId: string): Promise<boolean>;
  markEventHandled(eventId: string): Promise<void>;

  // Production
  savePreflight(rec: PreflightResultRecord): Promise<PreflightResultRecord>;
  getPreflight(id: string): Promise<PreflightResultRecord | undefined>;
  addProductionAsset(pa: ProductionAsset): Promise<ProductionAsset>;
  getProductionAsset(id: string): Promise<ProductionAsset | undefined>;
  listProductionAssetsByOrder(orderId: string): Promise<ProductionAsset[]>;
  addProductionJob(j: ProductionJob): Promise<ProductionJob>;
  getProductionJobByOrder(orderId: string): Promise<ProductionJob | undefined>;
  listProductionJobs(): Promise<ProductionJob[]>;
  saveProductionJob(j: ProductionJob): Promise<ProductionJob>;

  // Inventory
  getInventory(
    productId: string,
    colour: string,
    size: string,
  ): Promise<InventoryRecord | undefined>;
  setInventory(rec: InventoryRecord): Promise<void>;
  adjustInventory(
    productId: string,
    colour: string,
    size: string,
    delta: number,
  ): Promise<InventoryRecord | undefined>;
  listInventory(): Promise<InventoryRecord[]>;

  // Shipments
  createShipment(s: Shipment): Promise<Shipment>;
  getShipment(id: string): Promise<Shipment | undefined>;
  getShipmentByTracking(tracking: string): Promise<Shipment | undefined>;
  saveShipment(s: Shipment): Promise<Shipment>;

  // Refunds
  createRefund(r: Refund): Promise<Refund>;
  listRefunds(orderId?: string): Promise<Refund[]>;
  saveRefund(r: Refund): Promise<Refund>;

  // Notifications
  addNotification(n: Notification): Promise<Notification>;
  listNotifications(orderId?: string): Promise<Notification[]>;

  // Config & admin
  getPricingConfig(): Promise<PricingConfig>;
  setPricingConfig(c: PricingConfig): Promise<PricingConfig>;
  getAdminByEmail(email: string): Promise<AdminUser | undefined>;

  // Analytics
  recordEvent(e: AnalyticsEvent): Promise<void>;
  listEvents(): Promise<AnalyticsEvent[]>;
}

interface DbState {
  seq: number;
  designs: Record<string, Design>;
  assets: Record<string, DesignAsset>;
  carts: Record<string, Cart>;
  orders: Record<string, Order>;
  payments: Record<string, Payment>;
  productionAssets: Record<string, ProductionAsset>;
  preflights: Record<string, PreflightResultRecord>;
  jobs: Record<string, ProductionJob>;
  inventory: Record<string, InventoryRecord>;
  shipments: Record<string, Shipment>;
  refunds: Record<string, Refund>;
  notifications: Record<string, Notification>;
  events: AnalyticsEvent[];
  handledEvents: string[];
  pricingConfig: PricingConfig;
  admins: Record<string, AdminUser>;
}

const DB_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "db.json");

function seedState(): DbState {
  const inventory: Record<string, InventoryRecord> = {};
  for (const p of SEED_PRODUCTS) {
    for (const colour of p.colours) {
      for (const size of p.sizes) {
        const rec: InventoryRecord = {
          productId: p.id,
          colour: colour.name,
          size,
          quantityAvailable: 25,
        };
        inventory[variantKey(p.id, colour.name, size)] = rec;
      }
    }
  }
  const admin: AdminUser = {
    id: newId("adm"),
    email: "owner@oneofone.co.za",
    name: "Store Owner",
    role: "OWNER",
    createdAt: new Date().toISOString(),
  };
  return {
    seq: 0,
    designs: {},
    assets: {},
    carts: {},
    orders: {},
    payments: {},
    productionAssets: {},
    preflights: {},
    jobs: {},
    inventory,
    shipments: {},
    refunds: {},
    notifications: {},
    events: [],
    handledEvents: [],
    pricingConfig: DEFAULT_PRICING_CONFIG,
    admins: { [admin.id]: admin },
  };
}

export class InMemoryRepo implements Repo {
  private state: DbState;

  constructor() {
    this.state = this.load();
  }

  private load(): DbState {
    try {
      if (existsSync(DB_FILE)) {
        const parsed = JSON.parse(readFileSync(DB_FILE, "utf8")) as DbState;
        // Ensure newer collections exist if loading an older file.
        return { ...seedState(), ...parsed };
      }
    } catch {
      // Corrupt file — fall back to a fresh seed rather than crashing.
    }
    const seeded = seedState();
    this.persist(seeded);
    return seeded;
  }

  private persist(state: DbState = this.state): void {
    try {
      if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });
      writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
    } catch {
      // Best-effort durability in dev; never crash a request over persistence.
    }
  }

  // Designs & assets
  async createDesign(d: Design) {
    this.state.designs[d.id] = d;
    this.persist();
    return d;
  }
  async getDesign(id: string) {
    return this.state.designs[id];
  }
  async saveDesign(d: Design) {
    this.state.designs[d.id] = d;
    this.persist();
    return d;
  }
  async listDesignsByUser(userId: string) {
    return Object.values(this.state.designs).filter((d) => d.userId === userId);
  }
  async addAsset(a: DesignAsset) {
    this.state.assets[a.id] = a;
    this.persist();
    return a;
  }
  async getAsset(id: string) {
    return this.state.assets[id];
  }
  async listAssetsByDesign(designId: string) {
    return Object.values(this.state.assets).filter((a) => a.designId === designId);
  }
  async findAssetByHash(hash: string) {
    return Object.values(this.state.assets).find((a) => a.hash === hash);
  }

  // Carts
  async createCart(cart: Cart) {
    this.state.carts[cart.id] = cart;
    this.persist();
    return cart;
  }
  async getCart(id: string) {
    return this.state.carts[id];
  }
  async saveCart(cart: Cart) {
    this.state.carts[cart.id] = cart;
    this.persist();
    return cart;
  }

  // Orders
  async nextOrderSeq() {
    this.state.seq += 1;
    this.persist();
    return this.state.seq;
  }
  async createOrder(o: Order) {
    this.state.orders[o.id] = o;
    this.persist();
    return o;
  }
  async getOrder(id: string) {
    return this.state.orders[id];
  }
  async getOrderByNumber(orderNumber: string) {
    return Object.values(this.state.orders).find(
      (o) => o.orderNumber === orderNumber,
    );
  }
  async listOrders(filter?: OrderFilter) {
    let list = Object.values(this.state.orders).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    if (filter?.status) list = list.filter((o) => o.status === filter.status);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.name.toLowerCase().includes(q) ||
          o.customer.email.toLowerCase().includes(q),
      );
    }
    return list;
  }
  async saveOrder(o: Order) {
    this.state.orders[o.id] = o;
    this.persist();
    return o;
  }

  // Payments
  async createPayment(p: Payment) {
    this.state.payments[p.id] = p;
    this.persist();
    return p;
  }
  async getPayment(id: string) {
    return this.state.payments[id];
  }
  async getPaymentByOrder(orderId: string) {
    return Object.values(this.state.payments).find((p) => p.orderId === orderId);
  }
  async getPaymentByProviderRef(ref: string) {
    return Object.values(this.state.payments).find((p) => p.providerRef === ref);
  }
  async savePayment(p: Payment) {
    this.state.payments[p.id] = p;
    this.persist();
    return p;
  }
  async isEventHandled(eventId: string) {
    return this.state.handledEvents.includes(eventId);
  }
  async markEventHandled(eventId: string) {
    if (!this.state.handledEvents.includes(eventId)) {
      this.state.handledEvents.push(eventId);
      this.persist();
    }
  }

  // Production
  async savePreflight(rec: PreflightResultRecord) {
    this.state.preflights[rec.id] = rec;
    this.persist();
    return rec;
  }
  async getPreflight(id: string) {
    return this.state.preflights[id];
  }
  async addProductionAsset(pa: ProductionAsset) {
    this.state.productionAssets[pa.id] = pa;
    this.persist();
    return pa;
  }
  async getProductionAsset(id: string) {
    return this.state.productionAssets[id];
  }
  async listProductionAssetsByOrder(orderId: string) {
    return Object.values(this.state.productionAssets).filter(
      (pa) => pa.orderId === orderId,
    );
  }
  async addProductionJob(j: ProductionJob) {
    this.state.jobs[j.id] = j;
    this.persist();
    return j;
  }
  async getProductionJobByOrder(orderId: string) {
    return Object.values(this.state.jobs).find((j) => j.orderId === orderId);
  }
  async listProductionJobs() {
    return Object.values(this.state.jobs).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }
  async saveProductionJob(j: ProductionJob) {
    this.state.jobs[j.id] = j;
    this.persist();
    return j;
  }

  // Inventory
  async getInventory(productId: string, colour: string, size: string) {
    return this.state.inventory[variantKey(productId, colour, size)];
  }
  async setInventory(rec: InventoryRecord) {
    this.state.inventory[variantKey(rec.productId, rec.colour, rec.size)] = rec;
    this.persist();
  }
  async adjustInventory(
    productId: string,
    colour: string,
    size: string,
    delta: number,
  ) {
    const key = variantKey(productId, colour, size);
    const rec = this.state.inventory[key];
    if (!rec) return undefined;
    rec.quantityAvailable = Math.max(0, rec.quantityAvailable + delta);
    this.persist();
    return rec;
  }
  async listInventory() {
    return Object.values(this.state.inventory);
  }

  // Shipments
  async createShipment(s: Shipment) {
    this.state.shipments[s.id] = s;
    this.persist();
    return s;
  }
  async getShipment(id: string) {
    return this.state.shipments[id];
  }
  async getShipmentByTracking(tracking: string) {
    return Object.values(this.state.shipments).find(
      (s) => s.trackingNumber === tracking,
    );
  }
  async saveShipment(s: Shipment) {
    this.state.shipments[s.id] = s;
    this.persist();
    return s;
  }

  // Refunds
  async createRefund(r: Refund) {
    this.state.refunds[r.id] = r;
    this.persist();
    return r;
  }
  async listRefunds(orderId?: string) {
    const list = Object.values(this.state.refunds);
    return orderId ? list.filter((r) => r.orderId === orderId) : list;
  }
  async saveRefund(r: Refund) {
    this.state.refunds[r.id] = r;
    this.persist();
    return r;
  }

  // Notifications
  async addNotification(n: Notification) {
    this.state.notifications[n.id] = n;
    this.persist();
    return n;
  }
  async listNotifications(orderId?: string) {
    const list = Object.values(this.state.notifications).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    return orderId ? list.filter((n) => n.orderId === orderId) : list;
  }

  // Config & admin
  async getPricingConfig() {
    return this.state.pricingConfig;
  }
  async setPricingConfig(c: PricingConfig) {
    this.state.pricingConfig = c;
    this.persist();
    return c;
  }
  async getAdminByEmail(email: string) {
    return Object.values(this.state.admins).find(
      (a) => a.email.toLowerCase() === email.toLowerCase(),
    );
  }

  // Analytics
  async recordEvent(e: AnalyticsEvent) {
    this.state.events.push(e);
    // Cap to avoid unbounded growth in dev.
    if (this.state.events.length > 5000) {
      this.state.events = this.state.events.slice(-5000);
    }
    this.persist();
  }
  async listEvents() {
    return this.state.events;
  }
}
