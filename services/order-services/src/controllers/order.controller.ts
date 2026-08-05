import { Request, Response } from "express";
import * as orderService from "../services/order.service";
import { handleServiceError } from "../utils/errors";

export async function createOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const { shippingAddress1, shippingAddress2, city, zip, country, phone, items } = req.body;

    if (!shippingAddress1 || !city || !zip || !country || !phone) {
      res.status(400).json({
        message: "shippingAddress1, city, zip, country, and phone are required",
      });
      return;
    }

    const order = await orderService.createOrder(req.user!.userId, {
      shippingAddress1, shippingAddress2, city, zip, country, phone, items,
    });
    res.status(201).json({ order });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function getMyOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const result = await orderService.listMyOrders(req.user!.userId, page, limit);
    res.status(200).json({
      orders: result.items,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function getOrderByIdHandler(req: Request, res: Response): Promise<void> {
  try {
    // isAdminOverride decided HERE, not left to the service to assume -
    // the controller is where "what does this caller's token actually
    // grant" gets read; the service just receives a plain boolean and
    // doesn't need to know anything about permission codes at all.
    const isAdminOverride = req.user!.permissions.includes("ORDER_READ_ANY");
    const order = await orderService.getOrderById(req.params.id, req.user!.userId, isAdminOverride);
    res.status(200).json({ order });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function listAllOrdersHandler(req: Request, res: Response): Promise<void> {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const result = await orderService.listAllOrders(status, page, limit);
    res.status(200).json({
      orders: result.items,
      pagination: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages },
    });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function updateOrderStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ message: "status is required" });
      return;
    }

    const order = await orderService.updateStatus(req.params.id, status);
    res.status(200).json({ order });
  } catch (err) {
    handleServiceError(err, res);
  }
}