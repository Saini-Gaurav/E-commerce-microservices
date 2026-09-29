import { Request, Response } from "express";
import * as reviewService from "../services/review.service";
import { handleServiceError } from "../utils/errors";

export async function listReviewsHandler(req: Request, res: Response): Promise<void> {
  try {
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await reviewService.listReviews(req.params.id, page, limit);
    res.status(200).json(result);
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function submitReviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { rating, comment } = req.body;
    if (rating === undefined || !comment) {
      res.status(400).json({ message: "rating and comment are required" });
      return;
    }

    const review = await reviewService.submitReview(
      req.user!.userId,
      req.user!.name,
      req.params.id,
      Number(rating),
      comment
    );
    res.status(201).json({ review });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function deleteReviewHandler(req: Request, res: Response): Promise<void> {
  try {
    await reviewService.deleteReview(req.user!.userId, req.params.reviewId);
    res.status(200).json({ message: "Review deleted" });
  } catch (err) {
    handleServiceError(err, res);
  }
}

export async function getMyReviewStatusHandler(req: Request, res: Response): Promise<void> {
  try {
    const status = await reviewService.getMyReviewStatus(req.user!.userId, req.params.id);
    res.status(200).json(status);
  } catch (err) {
    handleServiceError(err, res);
  }
}