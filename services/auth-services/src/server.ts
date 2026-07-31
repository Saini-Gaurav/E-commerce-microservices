import "dotenv/config";
import app from "./app";
import { loadRbacCache } from "./services/rbac.cache";

const PORT = process.env.PORT || 4001;

async function start(): Promise<void> {
  // Load role -> permissions into memory BEFORE accepting any traffic.
  // If this fails (e.g. DB unreachable, migrations not run), we want
  // the service to crash on boot rather than silently serve requests
  // that would deny every permission check.
  await loadRbacCache();

  app.listen(PORT, () => {
    console.log(`auth-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start auth-service:", err);
  process.exit(1);
});