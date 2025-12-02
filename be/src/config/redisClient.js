import { createClient } from "redis";

let redisClient;
let connectPromise = null;

const getRedisUrl = () =>
  process.env.REDIS_URL ||
  process.env.REDIS_TLS_URL || // support common Redis envs
  "redis://127.0.0.1:6379";

const createRedisClient = () => {
  const client = createClient({
    url: getRedisUrl(),
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 100, 2000), // linear backoff
    },
  });

  client.on("error", (err) => {
    console.error("[Redis] client error:", err.message);
  });
  client.on("reconnecting", () => {
    console.warn("[Redis] reconnecting...");
  });
  client.on("connect", () => {
    console.log("[Redis] connected");
  });

  return client;
};

export const getRedisClient = async () => {
  if (!redisClient) {
    redisClient = createRedisClient();
    connectPromise = redisClient.connect().catch((err) => {
      console.error("[Redis] failed to connect:", err.message);
      redisClient = null;
      throw err;
    });
  }

  if (connectPromise) {
    await connectPromise;
    connectPromise = null;
  } else if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient;
};

export const quitRedisClient = async () => {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit();
  }
  redisClient = null;
  connectPromise = null;
};
