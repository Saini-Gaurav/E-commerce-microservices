import { Request, Response } from "express";
import * as paymentService from "../services/payment.service";
import { handleServiceError } from "../utils/errors";

export async function initiatePaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const { orderId } = req.body;
    if (!orderId) {
      res.status(400).json({ message: "orderId is required" });
      return;
    }

    // Notice what's NOT here: no `amount` read from req.body anywhere in this file. The client physically cannot supply a price for this endpoint to use - that's the fix, enforced by the shape of the code itself, not just a validation check that could be forgotten or bypassed.
    const payment = await paymentService.initiatePayment(req.user!.userId, orderId);
    res.status(201).json({ payment });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function verifyPaymentHandler(req: Request, res: Response): Promise<void> {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({
        message: "razorpayOrderId, razorpayPaymentId, and razorpaySignature are required",
      });
      return;
    }

    const payment = await paymentService.verifyPayment(req.user!.userId, {
      razorpayOrderId, razorpayPaymentId, razorpaySignature,
    });
    res.status(200).json({ payment });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function getPaymentForOrderHandler(req: Request, res: Response): Promise<void> {
  try {
    const payment = await paymentService.getPaymentForOrder(req.user!.userId, req.params.orderId);
    res.status(200).json({ payment });
  } catch (err) {
    handleServiceError(err, res);
  }
}