import "dotenv/config";
import app from "./app";
import { loadRbacCache } from "./services/rbac.cache";

const PORT = process.env.PORT || 4001;

async function start(): Promise<void> {
  await loadRbacCache();

  app.listen(PORT, () => {
    console.log(`auth-service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start auth-service:", err);
  process.exit(1);
});