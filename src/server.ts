import { createContainer } from "./bootstrap/container";
import { appConfig } from "./config";
import { createApp } from "./app";
import { closeRateLimitStore, initializeRateLimitStore } from "./middleware/rateLimit";

async function start() {
  const rateLimitMode = await initializeRateLimitStore();
  const container = createContainer();
  const app = createApp(container);

  const server = app.listen(appConfig.port, () => {
    console.log(`Live Negotiation AI MVP running on http://localhost:${appConfig.port}`);
    console.log(
      `Persistence: ${container.persistenceMode} | AI mode: ${container.aiMode} | Rate limit: ${rateLimitMode}`
    );
  });

  async function shutdown() {
    await container.close();
    await closeRateLimitStore();
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void start();
