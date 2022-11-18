import { createRequire } from "module";
const requireMod = createRequire(import.meta.url);

if (!process.env.CI) {
  requireMod("dotenv-safe").config({
    path: `.env.${process.env.NODE_ENV}`,
    allowEmptyValues: true,
  });
}

export enum ENV_KEYS {
  PORT = "port",
  LND_HOST = "lndHost",
  LND_PORT = "lndPort",
  LND_MACAROON_ADMIN = "lndMacaroonAdmin",
  LND_MACAROON_READ_ONLY = "lndMacaroonReadOnly",
  LND_MACAROON_INVOICE = "lndMacaroonInvoice",
  LND_TLS_CERT = "lndTlsCert",
  DALLE_API_KEY = "dalleApiKey",
  DALLE_SECRET_KEY = "dalleSecretKey",
  DALLE_QUEUE_NAME = "dalleQueueName",
  STABLE_DIFFUSION_QUEUE_NAME = "stableDiffusionQueueName",
  DALLE_QUEUE_CONCURRENCY = "dalleQueueConcurrency",
  STABLE_DIFFUSION_QUEUE_CONCURRENCY = "stableDiffusionQueueConcurrency",
  REDIS_CONNECTION_STRING = "redisConnectionString",
  REDIS_USERNAME = "redisUsername",
  REDIS_PASSWORD = "redisPassword",
  REDIS_HOST = "redisHost",
  REDIS_PORT = "redisPort",
  STABILITY_API_KEY = "stabilityApiKey",
  SUPABASE_URL = "supabaseUrl",
  SUPABASE_API_KEY = "supabaseApiKey",
  TELEGRAM_PRIVATE_NOTIFIER_BOT_TOKEN = "telegramPrivateNotifierBotToken",
  TELEGRAM_GENERATIONS_BOT_TOKEN = "telegramGenerationsBotToken",
  TELEGRAM_GROUP_ID_MICROPAY = "telegramGroupIdMicropay",
  TELEGRAM_USER_ID_DILLION = "telegramUserIdDillion",
  TELEGRAM_USER_ID_HASEAB = "telegramUserIdHaseab",
  SENTRY_DSN = "sentryDsn",
  AWS_ACCESS_KEY = "awsAccessKey",
  AWS_SECRET_KEY = "awsSecretKey",
  AWS_DALLE_BUCKET_NAME = "awsDalleBucketName",
  AWS_STABLE_DIFFUSION_BUCKET_NAME = "awsStableDiffusionBucketName",
  MOCK_IMAGES = "mockImages",
  GITHUB_CI_TOKEN = "githubCIToken",
  CODECOV_TOKEN = "codecovToken",
  TWITTER_APP_KEY = "twitterAppKey",
  TWITTER_APP_SECRET = "twitterAppSecret",
  TWITTER_ACCESS_TOKEN = "twitterAccessToken",
  TWITTER_ACCESS_SECRET = "twitterAccessSecret",
}

export interface Config {
  [ENV_KEYS.PORT]: string | number;
  [ENV_KEYS.LND_HOST]: string;
  [ENV_KEYS.LND_PORT]: string | number;
  [ENV_KEYS.LND_MACAROON_ADMIN]: string;
  [ENV_KEYS.LND_MACAROON_READ_ONLY]: string;
  [ENV_KEYS.LND_MACAROON_INVOICE]: string;
  [ENV_KEYS.LND_TLS_CERT]: string;
  [ENV_KEYS.DALLE_API_KEY]: string;
  [ENV_KEYS.DALLE_SECRET_KEY]: string;
  [ENV_KEYS.DALLE_QUEUE_NAME]: string;
  [ENV_KEYS.STABLE_DIFFUSION_QUEUE_NAME]: string;
  [ENV_KEYS.STABLE_DIFFUSION_QUEUE_CONCURRENCY]: string;
  [ENV_KEYS.DALLE_QUEUE_CONCURRENCY]: string;
  [ENV_KEYS.STABILITY_API_KEY]: string;
  [ENV_KEYS.REDIS_CONNECTION_STRING]: string;
  [ENV_KEYS.REDIS_USERNAME]: string;
  [ENV_KEYS.REDIS_PASSWORD]: string;
  [ENV_KEYS.REDIS_HOST]: string;
  [ENV_KEYS.REDIS_PORT]: string;
  [ENV_KEYS.SUPABASE_URL]: string;
  [ENV_KEYS.SUPABASE_API_KEY]: string;
  [ENV_KEYS.TELEGRAM_PRIVATE_NOTIFIER_BOT_TOKEN]: string;
  [ENV_KEYS.TELEGRAM_GENERATIONS_BOT_TOKEN]: string;
  [ENV_KEYS.TELEGRAM_USER_ID_DILLION]: string;
  [ENV_KEYS.TELEGRAM_GROUP_ID_MICROPAY]: string;
  [ENV_KEYS.TELEGRAM_USER_ID_HASEAB]: string;
  [ENV_KEYS.SENTRY_DSN]: string;
  [ENV_KEYS.AWS_ACCESS_KEY]: string;
  [ENV_KEYS.AWS_SECRET_KEY]: string;
  [ENV_KEYS.AWS_DALLE_BUCKET_NAME]: string;
  [ENV_KEYS.AWS_STABLE_DIFFUSION_BUCKET_NAME]: string;
  [ENV_KEYS.MOCK_IMAGES]: string;
  [ENV_KEYS.GITHUB_CI_TOKEN]: string;
  [ENV_KEYS.CODECOV_TOKEN]: string;
  [ENV_KEYS.TWITTER_APP_KEY]: string;
  [ENV_KEYS.TWITTER_APP_SECRET]: string;
  [ENV_KEYS.TWITTER_ACCESS_TOKEN]: string;
  [ENV_KEYS.TWITTER_ACCESS_SECRET]: string;
}

export const config: Config = {
  [ENV_KEYS.PORT]: process.env.PORT || "3002",
  [ENV_KEYS.LND_HOST]: process.env.LND_HOST,
  [ENV_KEYS.LND_PORT]: process.env.LND_PORT || "10009",
  [ENV_KEYS.LND_MACAROON_ADMIN]:
    process.env.NODE_ENV === "production"
      ? null
      : process.env.LND_MACAROON_ADMIN, // safety check. No admin macaroon in production,
  [ENV_KEYS.LND_MACAROON_READ_ONLY]: process.env.LND_MACAROON_READ_ONLY,
  [ENV_KEYS.LND_MACAROON_INVOICE]: process.env.LND_MACAROON_INVOICE,
  [ENV_KEYS.LND_TLS_CERT]: process.env.LND_TLS_CERT,
  [ENV_KEYS.DALLE_API_KEY]: process.env.DALLE_API_KEY,
  [ENV_KEYS.DALLE_SECRET_KEY]: process.env.DALLE_SECRET_KEY,
  [ENV_KEYS.DALLE_QUEUE_NAME]: process.env.DALLE_QUEUE_NAME,
  [ENV_KEYS.STABLE_DIFFUSION_QUEUE_CONCURRENCY]:
    process.env.STABLE_DIFFUSION_QUEUE_CONCURRENCY,
  [ENV_KEYS.STABLE_DIFFUSION_QUEUE_NAME]:
    process.env.STABLE_DIFFUSION_QUEUE_NAME,
  [ENV_KEYS.DALLE_QUEUE_CONCURRENCY]:
    process.env.DALLE_QUEUE_CONCURRENCY || "20",
  [ENV_KEYS.REDIS_CONNECTION_STRING]: process.env.REDIS_CONNECTION_STRING,
  [ENV_KEYS.REDIS_USERNAME]: process.env.REDIS_USERNAME,
  [ENV_KEYS.REDIS_PASSWORD]: process.env.REDIS_PASSWORD,
  [ENV_KEYS.REDIS_HOST]: process.env.REDIS_HOST,
  [ENV_KEYS.REDIS_PORT]: process.env.REDIS_PORT || "6379",
  [ENV_KEYS.STABILITY_API_KEY]: process.env.STABILITY_API_KEY,
  [ENV_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
  [ENV_KEYS.SUPABASE_API_KEY]: process.env.SUPABASE_API_KEY,
  [ENV_KEYS.TELEGRAM_PRIVATE_NOTIFIER_BOT_TOKEN]:
    process.env.TELEGRAM_PRIVATE_NOTIFIER_BOT_TOKEN,
  [ENV_KEYS.TELEGRAM_GENERATIONS_BOT_TOKEN]:
    process.env.TELEGRAM_GENERATIONS_BOT_TOKEN,
  [ENV_KEYS.TELEGRAM_GROUP_ID_MICROPAY]: process.env.TELEGRAM_GROUP_ID_MICROPAY,
  [ENV_KEYS.TELEGRAM_USER_ID_DILLION]: process.env.TELEGRAM_USER_ID_DILLION,
  [ENV_KEYS.TELEGRAM_USER_ID_HASEAB]: process.env.TELEGRAM_USER_ID_HASEAB,
  [ENV_KEYS.SENTRY_DSN]: process.env.SENTRY_DSN,
  [ENV_KEYS.AWS_ACCESS_KEY]: process.env.AWS_ACCESS_KEY,
  [ENV_KEYS.AWS_SECRET_KEY]: process.env.AWS_SECRET_KEY,
  [ENV_KEYS.AWS_DALLE_BUCKET_NAME]: process.env.AWS_DALLE_BUCKET_NAME,
  [ENV_KEYS.AWS_STABLE_DIFFUSION_BUCKET_NAME]:
    process.env.AWS_STABLE_DIFFUSION_BUCKET_NAME,
  [ENV_KEYS.MOCK_IMAGES]: process.env.MOCK_IMAGES,
  [ENV_KEYS.GITHUB_CI_TOKEN]:
    process.env.NODE_ENV === "production" ? null : process.env.GITHUB_CI_TOKEN,
  [ENV_KEYS.CODECOV_TOKEN]:
    process.env.NODE_ENV === "production" ? null : process.env.CODECOV_TOKEN,
  [ENV_KEYS.TWITTER_APP_KEY]: process.env.TWITTER_APP_KEY,
  [ENV_KEYS.TWITTER_APP_SECRET]: process.env.TWITTER_APP_SECRET,
  [ENV_KEYS.TWITTER_ACCESS_TOKEN]: process.env.TWITTER_ACCESS_TOKEN,
  [ENV_KEYS.TWITTER_ACCESS_SECRET]: process.env.TWITTER_ACCESS_SECRET,
};
