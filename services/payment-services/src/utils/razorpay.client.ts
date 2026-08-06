import Razorpay from "razorpay";

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error("Missing required env var: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
}

// One shared instance for the whole service - the SDK doesn't hold a live connection like a database pool does, so there's no "pool size" concept here; this is just avoiding re-reading env vars and re-constructing the client on every request.
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});