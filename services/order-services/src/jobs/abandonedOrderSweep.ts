import { sweepAbandonedOrders } from "../services/order.service";

const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS) || 5 * 60 * 1000; // every 5 minutes default

export function startAbandonedOrderSweep(): void {
  setInterval(() => {
    sweepAbandonedOrders().catch((err) => {
      console.error("Abandoned order sweep failed:", err);
    });
  }, SWEEP_INTERVAL_MS);

  console.log(`Abandoned order sweep scheduled every ${SWEEP_INTERVAL_MS / 1000}s`);
}