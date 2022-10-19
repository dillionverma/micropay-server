import IORedis from "ioredis";
import { config } from "../config";

export const connection = new IORedis({
  port: 6379,
  host: config.redisHost || "127.0.0.1",
  // password: config.redisPass || "",
  password: "",
  maxRetriesPerRequest: null,
  reconnectOnError(err) {
    console.error(err);
    return true;
  },
});
