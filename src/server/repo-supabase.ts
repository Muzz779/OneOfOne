/**
 * Supabase/Postgres repository (CLAUDE.md §38, §40, §52).
 *
 * Implements the same {@link Repo} interface as the in-memory dev repo, so the
 * container can swap it in when Supabase is configured — no call-site changes.
 * Each aggregate is stored as a JSONB `data` document plus a few indexed columns
 * for filtering. Uses the service-role client; the app authorizes each call.
 */

import "server-only";
import { supabaseAdmin } from "./supabase/clients";
import type { OrderFilter, Repo } from "./repo";
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
  User,
} from "@/domain/entities";
import { variantKey } from "@/domain/entities";
import type { AnalyticsEvent } from "@/domain/analytics";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/domain/pricing";

type Row<T> = { data: T };

function db() {
  return supabaseAdmin();
}

async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await db().from(table).upsert(row);
  if (error) throw new Error(`${table} write failed: ${error.message}`);
}

async function readOne<T>(table: string, column: string, value: string): Promise<T | undefined> {
  const { data, error } = await db().from(table).select("data").eq(column, value).limit(1).maybeSingle();
  if (error) throw new Error(`${table} read failed: ${error.message}`);
  return (data as Row<T> | null)?.data;
}

async function readMany<T>(
  table: string,
  filter?: { column: string; value: string },
): Promise<T[]> {
  let q = db().from(table).select("data");
  if (filter) q = q.eq(filter.column, filter.value);
  const { data, error } = await q;
  if (error) throw new Error(`${table} list failed: ${error.message}`);
  return (data as Row<T>[] | null)?.map((r) => r.data) ?? [];
}

export class SupabaseRepo implements Repo {
  // Designs & assets
  async createDesign(d: Design) {
    await insert("designs", { id: d.id, user_id: d.userId ?? null, data: d });
    return d;
  }
  async getDesign(id: string) {
    return readOne<Design>("designs", "id", id);
  }
  async saveDesign(d: Design) {
    await insert("designs", { id: d.id, user_id: d.userId ?? null, data: d });
    return d;
  }
  async listDesignsByUser(userId: string) {
    return readMany<Design>("designs", { column: "user_id", value: userId });
  }
  async addAsset(a: DesignAsset) {
    await insert("assets", { id: a.id, design_id: a.designId, hash: a.hash, data: a });
    return a;
  }
  async getAsset(id: string) {
    return readOne<DesignAsset>("assets", "id", id);
  }
  async listAssetsByDesign(designId: string) {
    return readMany<DesignAsset>("assets", { column: "design_id", value: designId });
  }
  async findAssetByHash(hash: string) {
    return readOne<DesignAsset>("assets", "hash", hash);
  }

  // Carts
  async createCart(cart: Cart) {
    await insert("carts", { id: cart.id, data: cart });
    return cart;
  }
  async getCart(id: string) {
    return readOne<Cart>("carts", "id", id);
  }
  async saveCart(cart: Cart) {
    await insert("carts", { id: cart.id, data: cart });
    return cart;
  }

  // Orders
  async nextOrderSeq() {
    const { data, error } = await db().rpc("next_order_seq");
    if (error) throw new Error(`order seq failed: ${error.message}`);
    return Number(data);
  }
  async createOrder(o: Order) {
    await this.saveOrder(o);
    return o;
  }
  async getOrder(id: string) {
    return readOne<Order>("orders", "id", id);
  }
  async getOrderByNumber(orderNumber: string) {
    return readOne<Order>("orders", "order_number", orderNumber);
  }
  async listOrders(filter?: OrderFilter) {
    let q = db().from("orders").select("data").order("created_at", { ascending: false });
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) throw new Error(`orders list failed: ${error.message}`);
    let list = (data as Row<Order>[] | null)?.map((r) => r.data) ?? [];
    if (filter?.search) {
      const s = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(s) ||
          o.customer.name.toLowerCase().includes(s) ||
          o.customer.email.toLowerCase().includes(s),
      );
    }
    return list;
  }
  async saveOrder(o: Order) {
    await insert("orders", {
      id: o.id,
      order_number: o.orderNumber,
      user_id: o.userId ?? null,
      status: o.status,
      created_at: o.createdAt,
      data: o,
    });
    return o;
  }

  // Payments
  async createPayment(p: Payment) {
    await this.savePayment(p);
    return p;
  }
  async getPayment(id: string) {
    return readOne<Payment>("payments", "id", id);
  }
  async getPaymentByOrder(orderId: string) {
    return readOne<Payment>("payments", "order_id", orderId);
  }
  async getPaymentByProviderRef(ref: string) {
    return readOne<Payment>("payments", "provider_ref", ref);
  }
  async savePayment(p: Payment) {
    await insert("payments", { id: p.id, order_id: p.orderId, provider_ref: p.providerRef ?? null, data: p });
    return p;
  }
  async isEventHandled(eventId: string) {
    const { data } = await db().from("handled_events").select("event_id").eq("event_id", eventId).maybeSingle();
    return Boolean(data);
  }
  async markEventHandled(eventId: string) {
    await db().from("handled_events").upsert({ event_id: eventId });
  }

  // Production
  async savePreflight(rec: PreflightResultRecord) {
    await insert("preflights", { id: rec.id, data: rec });
    return rec;
  }
  async getPreflight(id: string) {
    return readOne<PreflightResultRecord>("preflights", "id", id);
  }
  async addProductionAsset(pa: ProductionAsset) {
    await insert("production_assets", { id: pa.id, order_id: pa.orderId, order_item_id: pa.orderItemId, data: pa });
    return pa;
  }
  async getProductionAsset(id: string) {
    return readOne<ProductionAsset>("production_assets", "id", id);
  }
  async listProductionAssetsByOrder(orderId: string) {
    return readMany<ProductionAsset>("production_assets", { column: "order_id", value: orderId });
  }
  async addProductionJob(j: ProductionJob) {
    await insert("jobs", { id: j.id, order_id: j.orderId, created_at: j.createdAt, data: j });
    return j;
  }
  async getProductionJobByOrder(orderId: string) {
    return readOne<ProductionJob>("jobs", "order_id", orderId);
  }
  async listProductionJobs() {
    const { data, error } = await db().from("jobs").select("data").order("created_at", { ascending: false });
    if (error) throw new Error(`jobs list failed: ${error.message}`);
    return (data as Row<ProductionJob>[] | null)?.map((r) => r.data) ?? [];
  }
  async saveProductionJob(j: ProductionJob) {
    await insert("jobs", { id: j.id, order_id: j.orderId, created_at: j.createdAt, data: j });
    return j;
  }

  // Inventory
  async getInventory(productId: string, colour: string, size: string) {
    const { data } = await db()
      .from("inventory")
      .select("product_id, colour, size, quantity")
      .eq("key", variantKey(productId, colour, size))
      .maybeSingle();
    if (!data) return undefined;
    const r = data as { product_id: string; colour: string; size: string; quantity: number };
    return { productId: r.product_id, colour: r.colour, size: r.size, quantityAvailable: r.quantity };
  }
  async setInventory(rec: InventoryRecord) {
    await db().from("inventory").upsert({
      key: variantKey(rec.productId, rec.colour, rec.size),
      product_id: rec.productId,
      colour: rec.colour,
      size: rec.size,
      quantity: rec.quantityAvailable,
    });
  }
  async adjustInventory(productId: string, colour: string, size: string, delta: number) {
    const current = await this.getInventory(productId, colour, size);
    if (!current) return undefined;
    const next = { ...current, quantityAvailable: Math.max(0, current.quantityAvailable + delta) };
    await this.setInventory(next);
    return next;
  }
  async listInventory() {
    const { data, error } = await db().from("inventory").select("product_id, colour, size, quantity");
    if (error) throw new Error(`inventory list failed: ${error.message}`);
    return (
      (data as { product_id: string; colour: string; size: string; quantity: number }[] | null)?.map((r) => ({
        productId: r.product_id,
        colour: r.colour,
        size: r.size,
        quantityAvailable: r.quantity,
      })) ?? []
    );
  }

  // Shipments
  async createShipment(s: Shipment) {
    await this.saveShipment(s);
    return s;
  }
  async getShipment(id: string) {
    return readOne<Shipment>("shipments", "id", id);
  }
  async getShipmentByTracking(tracking: string) {
    return readOne<Shipment>("shipments", "tracking", tracking);
  }
  async saveShipment(s: Shipment) {
    await insert("shipments", { id: s.id, order_id: s.orderId, tracking: s.trackingNumber ?? null, data: s });
    return s;
  }

  // Refunds
  async createRefund(r: Refund) {
    await this.saveRefund(r);
    return r;
  }
  async listRefunds(orderId?: string) {
    return readMany<Refund>("refunds", orderId ? { column: "order_id", value: orderId } : undefined);
  }
  async saveRefund(r: Refund) {
    await insert("refunds", { id: r.id, order_id: r.orderId, data: r });
    return r;
  }

  // Notifications
  async addNotification(n: Notification) {
    await insert("notifications", { id: n.id, order_id: n.orderId ?? null, created_at: n.createdAt, data: n });
    return n;
  }
  async listNotifications(orderId?: string) {
    let q = db().from("notifications").select("data").order("created_at", { ascending: false });
    if (orderId) q = q.eq("order_id", orderId);
    const { data, error } = await q;
    if (error) throw new Error(`notifications list failed: ${error.message}`);
    return (data as Row<Notification>[] | null)?.map((r) => r.data) ?? [];
  }

  // Customers
  async createUser(u: User) {
    await insert("users", { id: u.id, email: u.email.toLowerCase(), data: u });
    return u;
  }
  async getUser(id: string) {
    return readOne<User>("users", "id", id);
  }
  async getUserByEmail(email: string) {
    return readOne<User>("users", "email", email.toLowerCase());
  }
  async listOrdersByUser(userId: string) {
    const { data, error } = await db()
      .from("orders")
      .select("data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`orders by user failed: ${error.message}`);
    return (data as Row<Order>[] | null)?.map((r) => r.data) ?? [];
  }

  // Config & admin
  async getPricingConfig() {
    const cfg = await readOne<PricingConfig>("pricing_config", "id", "default");
    return cfg ?? DEFAULT_PRICING_CONFIG;
  }
  async setPricingConfig(c: PricingConfig) {
    await insert("pricing_config", { id: "default", data: c });
    return c;
  }
  async getAdminByEmail(email: string) {
    return readOne<AdminUser>("admins", "email", email.toLowerCase());
  }

  // Analytics
  async recordEvent(e: AnalyticsEvent) {
    await insert("events", { id: e.id, type: e.type, created_at: e.at, data: e });
  }
  async listEvents() {
    return readMany<AnalyticsEvent>("events");
  }
}
