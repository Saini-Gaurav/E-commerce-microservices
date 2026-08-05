import {
  createOrderWithItems,
  findOrderById,
  findOrderItemsByOrderId,
  findOrdersByUserId,
  countOrdersByUserId,
  findAllOrders,
  countAllOrders,
  updateOrderStatus as updateOrderStatusInDb,
  OrderRow,
  OrderItemRow,
} from "../repositories/order.repository";
import { findProductInCache } from "../repositories/productCache.repository";
import { publishOrderCreated } from "../events/orderEvents.publisher";
import { ServiceError } from "../utils/errors";

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
  input: CreateOrderInput
): Promise<OrderResponse> {
  if (!input.items || input.items.length === 0) {
    throw new ServiceError("An order must contain at least one item", 400);
  }

  // Validate + snapshot EVERY item against the local cache before writing anything - fail the whole request if even one item is bad, rather than saving a partial order. This loop touches no database yet; it's pure validation against data already sitting in memory via Postgres reads to product_cache, no network calls at all.
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
      // Could genuinely mean "this product doesn't exist," OR "it exists but this service's cache hasn't heard about it yet" (the eventual-consistency gap named back in the design brief). From the client's point of view both look the same: "can't order this right now" - a 400, not a 500.
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
  });

  // Announce it AFTER the DB transaction has already committed - the  order is safely saved no matter what happens to this Kafka call. Deliberately not awaited-and-blocking the response any further than this one call; if this throws, we log it but still return the order successfully (see publishOrderCreated's own internal handling) - a stock-decrement delay is not a reason to tell the customer their order failed when it didn't.
  await publishOrderCreated(
    order.id,
    userId,
    preparedItems.map((i) => ({ productId: i.productId, quantity: i.quantity }))
  );

  return toOrderResponse(order, items);
}

/**
 * Ownership + RBAC combined: an admin (isAdminOverride = true, decided
 * by the controller checking permissions) can view ANY order; anyone
 * else can only view their OWN. This is the pattern named back when we
 * started this service - order-service is the first one needing both
 * kinds of authorization on the same action.
 */
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
    // 404, not 403: telling a non-owner "this exists but isn't yours" confirms the order id is valid, which is itself a small information leak (e.g. confirms guessed sequential-feeling ids are real). Pretending it doesn't exist at all reveals nothing.
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

  const items = await findOrderItemsByOrderId(orderId);
  return toOrderResponse(updated, items);
}