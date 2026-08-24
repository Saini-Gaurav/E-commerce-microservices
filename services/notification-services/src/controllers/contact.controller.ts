import { Request, Response } from "express";
import * as contactService from "../services/contact.service";
import { handleServiceError } from "../utils/errors";

export async function submitContactHandler(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      res.status(400).json({ message: "name, email, subject, and message are all required" });
      return;
    }

    await contactService.submitContactMessage({ name, email, subject, message });
    res.status(200).json({ message: "Message sent - we'll get back to you soon" });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function listMessagesHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    const result = await contactService.listMessages(page, limit);
    res.status(200).json(result);
  } catch (err) {
    handleServiceError(err, res);
  }
}