import {
  findReviewsByProductId,
  countReviewsByProductId,
  findReviewByUserAndProduct, 
  findReviewById,
  upsertReviewAndRecalculate,
  deleteReviewAndRecalculate,
  ReviewRow,
} from "../repositories/review.repository";
import { hasUserPurchased } from "../repositories/productPurchase.repository";
import { findProductById } from "../repositories/product.repository";
import { ServiceError } from "../utils/errors";

export interface ReviewResponse {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

function toReviewResponse(row: ReviewRow): ReviewResponse {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    userName: row.user_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listReviews(productId: string, page: number, limit: number) {
  const product = await findProductById(productId);
  if (!product) throw new ServiceError("Product not found", 404);

  const offset = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    findReviewsByProductId(productId, limit, offset),
    countReviewsByProductId(productId),
  ]);

  return {
    reviews: rows.map(toReviewResponse),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

export async function submitReview(
  userId: string,
  userName: string,
  productId: string,
  rating: number,
  comment: string
): Promise<ReviewResponse> {
  const product = await findProductById(productId);
  if (!product) throw new ServiceError("Product not found", 404);

  if (rating < 1 || rating > 5) {
    throw new ServiceError("rating must be between 1 and 5", 400);
  }
  if (!comment || comment.trim().length < 3) {
    throw new ServiceError("comment must be at least 3 characters", 400);
  }

  // The actual gate discussed in the design note: "ordered it" via
  // ORDER_CREATED, not "paid for it" or "received it." A real, named
  // trade-off - not a silent shortcut.
  const purchased = await hasUserPurchased(userId, productId);
  if (!purchased) {
    throw new ServiceError("You can only review products you've ordered", 403);
  }

  const review = await upsertReviewAndRecalculate({ productId, userId, userName, rating, comment });
  return toReviewResponse(review);
}

export async function deleteReview(userId: string, reviewId: string): Promise<void> {
  const review = await findReviewById(reviewId);
  if (!review) throw new ServiceError("Review not found", 404);

  if (review.user_id !== userId) {
    // Same ownership-privacy reasoning used throughout this build -
    // don't confirm the review id is real to someone who doesn't own it.
    throw new ServiceError("Review not found", 404);
  }

  await deleteReviewAndRecalculate(reviewId, review.product_id);
}

export async function getMyReviewStatus(userId: string, productId: string) {
  const [hasPurchased, review] = await Promise.all([
    hasUserPurchased(userId, productId),
    findReviewByUserAndProduct(userId, productId),
  ]);
  return { hasPurchased, review: review ? toReviewResponse(review) : null };
}