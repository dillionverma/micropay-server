import IORedis from "ioredis";
import { config } from "../config";

const port = Number(config.redisPort);
const host = config.redisHost;

export const connection = new IORedis({
  port,
  host,
  // password: config.redisPass || "",
  password: "",
  maxRetriesPerRequest: null,
  reconnectOnError(err) {
    console.error(err);
    return true;
  },
});
