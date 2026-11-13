import {
  createOrderWithItems,
  findOrderById,
  findOrderItemsByOrderId,
  findOrdersByUserId,
  countOrdersByUserId,
  findAllOrders,
  countAllOrders,
  findOrderByIdempotencyKey,
  updateOrderStatus as updateOrderStatusInDb,
  OrderRow,
  OrderItemRow,
  findAbandonedPendingOrders,
  getOrderStatusBreakdown,
  getOrderTotalsSince
} from "../repositories/order.repository";
import { findProductInCache } from "../repositories/productCache.repository";
import { publishOrderCreated, publishOrderCancelled, publishOrderStatusUpdated } from "../events/orderEvents.publisher";
import { ServiceError } from "../utils/errors";

const ABANDONED_ORDER_TIMEOUT_MS = Number(process.env.ABANDONED_ORDER_TIMEOUT_MS) || 30 * 60 * 1000;

const PAID_STATUSES = ["PROCESSING", "SHIPPED", "DELIVERED"];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface OrderStatsResponse {
  totalOrders: number;
  revenue: number;
  byStatus: Record<string, number>;
  last30Days: { orders: number; revenue: number };
}

export interface OrderItemResponse {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderResponse {
  id: string;
  userId: string;
  shippingAddress1: string;
  shippingAddress2: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  status: string;
  totalPrice: number;
  items: OrderItemResponse[];
  createdAt: Date;
}

function toOrderItemResponse(row: OrderItemRow): OrderItemResponse {
  return {
    productId: row.product_id,
    productName: row.product_name,
    unitPrice: Number(row.unit_price),
    quantity: row.quantity,
    lineTotal: Number(row.line_total),
  };
}

function toOrderResponse(order: OrderRow, items: OrderItemRow[]): OrderResponse {
  return {
    id: order.id,
    userId: order.user_id,
    shippingAddress1: order.shipping_address1,
    shippingAddress2: order.shipping_address2,
    city: order.city,
    zip: order.zip,
    country: order.country,
    phone: order.phone,
    status: order.status,
    totalPrice: Number(order.total_price),
    items: items.map(toOrderItemResponse),
    createdAt: order.created_at,
  };
}

export interface CreateOrderInput {
  shippingAddress1: string;
  shippingAddress2?: string;
  city: string;
  zip: string;
  country: string;
  phone: string;
  items: { productId: string; quantity: number }[];
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  idempotencyKey?: string
): Promise<OrderResponse> {
  if (idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      const items = await findOrderItemsByOrderId(existing.id);
      return toOrderResponse(existing, items);
    }
  }

  if (!input.items || input.items.length === 0) {
    throw new ServiceError("An order must contain at least one item", 400);
  }

  const preparedItems: {
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[] = [];

  for (const item of input.items) {
    if (item.quantity < 1) {
      throw new ServiceError(`quantity for product ${item.productId} must be at least 1`, 400);
    }

    const cached = await findProductInCache(item.productId);
    if (!cached) {
      throw new ServiceError(`Product ${item.productId} is not available`, 400);
    }

    const price = Number(cached.price);
    if (cached.count_in_stock < item.quantity) {
      throw new ServiceError(
        `Insufficient stock for "${cached.name}": only ${cached.count_in_stock} available`,
        400
      );
    }

    preparedItems.push({
      productId: item.productId,
      productName: cached.name,
      unitPrice: price,
      quantity: item.quantity,
      lineTotal: price * item.quantity,
    });
  }

  const totalPrice = preparedItems.reduce((sum, i) => sum + i.lineTotal, 0);

  const { order, items } = await createOrderWithItems({
    userId,
    shippingAddress1: input.shippingAddress1,
    shippingAddress2: input.shippingAddress2,
    city: input.city,
    zip: input.zip,
    country: input.country,
    phone: input.phone,
    items: preparedItems,
    totalPrice,
    idempotencyKey,
  });

  await publishOrderCreated(
    order.id,
    userId,
    preparedItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    totalPrice
  );

  return toOrderResponse(order, items);
}

export async function getOrderById(
  orderId: string,
  requestingUserId: string,
  isAdminOverride: boolean
): Promise<OrderResponse> {
  const order = await findOrderById(orderId);
  if (!order) {
    throw new ServiceError("Order not found", 404);
  }
  if (!isAdminOverride && order.user_id !== requestingUserId) {
    throw new ServiceError("Order not found", 404);
  }

  const items = await findOrderItemsByOrderId(orderId);
  return toOrderResponse(order, items);
}

export interface PaginatedOrders {
  items: OrderResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function listMyOrders(
  userId: string,
  page: number,
  limit: number
): Promise<PaginatedOrders> {
  const offset = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    findOrdersByUserId(userId, limit, offset),
    countOrdersByUserId(userId),
  ]);

  const withItems = await Promise.all(
    orders.map(async (order) => toOrderResponse(order, await findOrderItemsByOrderId(order.id)))
  );

  return { items: withItems, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function listAllOrders(
  status: string | undefined,
  page: number,
  limit: number
): Promise<PaginatedOrders> {
  const offset = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    findAllOrders(status, limit, offset),
    countAllOrders(status),
  ]);

  const withItems = await Promise.all(
    orders.map(async (order) => toOrderResponse(order, await findOrderItemsByOrderId(order.id)))
  );

  return { items: withItems, page, limit, total, totalPages: Math.ceil(total / limit) };
}

const VALID_STATUSES = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

export async function updateStatus(orderId: string, status: string): Promise<OrderResponse> {
  if (!VALID_STATUSES.includes(status)) {
    throw new ServiceError(`status must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  }

  const updated = await updateOrderStatusInDb(orderId, status);
  if (!updated) {
    throw new ServiceError("Order not found", 404);
  }

  await publishOrderStatusUpdated(orderId, updated.user_id, status);

  const items = await findOrderItemsByOrderId(orderId);
  return toOrderResponse(updated, items);
}

export async function sweepAbandonedOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - ABANDONED_ORDER_TIMEOUT_MS);
  const abandoned = await findAbandonedPendingOrders(cutoff);

  if (abandoned.length === 0) return;

  console.log(`Sweeping ${abandoned.length} abandoned order(s)`);

  for (const order of abandoned) {
    const updated = await updateOrderStatusInDb(order.id, "CANCELLED");
    if (!updated) continue; // shouldn't happen, but don't let one bad row stop the rest

    const items = await findOrderItemsByOrderId(order.id);
    await publishOrderCancelled(
      order.id,
      items.map((item) => ({ productId: item.product_id, quantity: item.quantity }))
    );

    console.log(`Order ${order.id} cancelled (abandoned, no payment attempted) - stock restore announced`);
  }
}

export async function getOrderStats(): Promise<OrderStatsResponse> {
  const [breakdown, recent] = await Promise.all([
    getOrderStatusBreakdown(),
    getOrderTotalsSince(30, PAID_STATUSES),
  ]);

  const byStatus: Record<string, number> = {};
  let totalOrders = 0;
  let revenue = 0;
  for (const row of breakdown) {
    byStatus[row.status] = row.count;
    totalOrders += row.count;
    if (PAID_STATUSES.includes(row.status)) revenue += row.total;
  }

  return {
    totalOrders,
    revenue: round2(revenue),
    byStatus,
    last30Days: { orders: recent.orders, revenue: round2(recent.revenue) },
  };
}