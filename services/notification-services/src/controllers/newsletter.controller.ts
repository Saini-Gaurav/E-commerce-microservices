import { Request, Response } from "express";
import * as newsletterService from "../services/newsletter.service";
import { handleServiceError } from "../utils/errors";

export async function subscribeHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ message: "email is required" });
      return;
    }

    await newsletterService.subscribe(email);
    res.status(200).json({ message: "Subscribed successfully" });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function listSubscribersHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const result = await newsletterService.listSubscribers(page, limit);
    res.status(200).json(result);
  } catch (err) {
    handleServiceError(err, res);
  }
}