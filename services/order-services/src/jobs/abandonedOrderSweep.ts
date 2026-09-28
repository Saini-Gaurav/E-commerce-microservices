import { sweepAbandonedOrders } from "../services/order.service";

const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS) || 5 * 60 * 1000; // every 5 minutes default

/**
 * A plain setInterval, not a real cron library - genuinely sufficient
 * here. This only needs to run "periodically, roughly every few
 * minutes, while the service is up" - it doesn't need cron's more
 * sophisticated scheduling (specific times of day, timezone handling),
 * so pulling in a dependency for that would be more than this job
 * actually needs.
 */
export function startAbandonedOrderSweep(): void {
  setInterval(() => {
    sweepAbandonedOrders().catch((err) => {
      console.error("Abandoned order sweep failed:", err);
    });
  }, SWEEP_INTERVAL_MS);

  console.log(`Abandoned order sweep scheduled every ${SWEEP_INTERVAL_MS / 1000}s`);
}