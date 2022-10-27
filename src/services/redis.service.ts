import Redis from "ioredis";
import { config } from "../config";

const {
  redisConnectionString,
  redisHost,
  redisPassword,
  redisPort,
  redisUsername,
} = config;

let connection;

if (config.redisConnectionString) {
  connection = new Redis(redisConnectionString, { maxRetriesPerRequest: null });
} else {
  connection = new Redis({
    username: redisUsername,
    password: redisPassword,
    host: redisHost,
    port: Number(redisPort),
    maxRetriesPerRequest: null,
    reconnectOnError(err) {
      console.error(err);
      return true;
    },
  });
}

export { connection };
