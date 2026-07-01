// Development helper: run an in-process mongod on 27017 so the smoke test
// doesn't need the docker daemon. Not used in prod.

import { MongoMemoryServer } from "mongodb-memory-server";

async function main(): Promise<void> {
  const server = await MongoMemoryServer.create({
    instance: { port: 27017, dbName: "whiteboard" },
  });
  const uri = server.getUri();
  console.log(`[dev-mongo] listening at ${uri}`);

  const shutdown = async (): Promise<void> => {
    console.log("[dev-mongo] stopping...");
    await server.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await new Promise<void>(() => {
    // block forever
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
