import { buildApp, createLlmClassifier } from "./app";
import { env } from "./config/env";

const app = buildApp({ llmClassifier: createLlmClassifier() });

async function start() {
  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error, "Failed to start server");
    process.exit(1);
  }
}

async function shutdown(signal: NodeJS.Signals) {
  app.log.info({ signal }, "Shutting down server");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "Failed to shutdown server gracefully");
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

void start();
