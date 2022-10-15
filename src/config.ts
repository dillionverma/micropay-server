import { createRequire } from "module";
const requireMod = createRequire(import.meta.url);

if (!process.env.CI) {
  requireMod("dotenv-safe").config({
    path: `.env.${process.env.NODE_ENV}`,
    allowEmptyValues: true,
  });
}

export interface Config {
  host: string;
  port: string | number;
  dalleApiKey: string;
  supabaseUrl: string;
  supabaseApiKey: string;
  personalTelegramToken: string;
  groupTelegramToken: string;
  telegramUserId: string;
  telegramGroupId: string;
  telegramUserIdHaseab: string;
  sentryDsn: string;
  awsAccessKey: string;
  awsSecretKey: string;
  adminMacaroon: string;
  readOnlyMacaroon: string;
  invoiceMacaroon: string;
  tlsCert: string;
  mockImages: string;
  tokenGithub: string;
  codecovToken: string;
}

export enum ENV_KEYS {
  HOST = "host",
  PORT = "port",
  DALLE_API_KEY = "dalleApiKey",
  SUPABASE_URL = "supabaseUrl",
  SUPABASE_API_KEY = "supabaseApiKey",
  PERSONAL_TELEGRAM_TOKEN = "personalTelegramToken",
  GROUP_TELEGRAM_TOKEN = "groupTelegramToken",
  TELEGRAM_USER_ID = "telegramUserId",
  TELEGRAM_GROUP_ID = "telegramGroupId",
  TELEGRAM_USER_ID_HASEAB = "telegramUserIdHaseab",
  SENTRY_DSN = "sentryDsn",
  AWS_ACCESS_KEY = "awsAccessKey",
  AWS_SECRET_KEY = "awsSecretKey",
  ADMIN_MACAROON = "adminMacaroon",
  READ_ONLY_MACAROON = "readOnlyMacaroon",
  INVOICE_MACAROON = "invoiceMacaroon",
  TLS_CERT = "tlsCert",
  MOCK_IMAGES = "mockImages",
  TOKEN_GITHUB = "tokenGithub",
  CODECOV_TOKEN = "codecovToken",
}

export const config: Config = {
  [ENV_KEYS.HOST]: process.env.HOST,
  [ENV_KEYS.PORT]: process.env.PORT || 3002,
  [ENV_KEYS.DALLE_API_KEY]: process.env.DALLE_API_KEY,
  [ENV_KEYS.SUPABASE_URL]: process.env.SUPABASE_URL,
  [ENV_KEYS.SUPABASE_API_KEY]: process.env.SUPABASE_API_KEY,
  [ENV_KEYS.PERSONAL_TELEGRAM_TOKEN]: process.env.PERSONAL_TELEGRAM_TOKEN,
  [ENV_KEYS.GROUP_TELEGRAM_TOKEN]: process.env.GROUP_TELEGRAM_TOKEN,
  [ENV_KEYS.TELEGRAM_USER_ID]: process.env.TELEGRAM_USER_ID,
  [ENV_KEYS.TELEGRAM_GROUP_ID]: process.env.TELEGRAM_GROUP_ID,
  [ENV_KEYS.TELEGRAM_USER_ID_HASEAB]: process.env.TELEGRAM_USER_ID_HASEAB,
  [ENV_KEYS.SENTRY_DSN]: process.env.SENTRY_DSN,
  [ENV_KEYS.AWS_ACCESS_KEY]: process.env.AWS_ACCESS_KEY,
  [ENV_KEYS.AWS_SECRET_KEY]: process.env.AWS_SECRET_KEY,
  [ENV_KEYS.ADMIN_MACAROON]:
    process.env.NODE_ENV === "production" ? null : process.env.ADMIN_MACAROON, // safety check. No admin macaroon in production,
  [ENV_KEYS.READ_ONLY_MACAROON]: process.env.READ_ONLY_MACAROON,
  [ENV_KEYS.INVOICE_MACAROON]: process.env.INVOICE_MACAROON,
  [ENV_KEYS.TLS_CERT]: process.env.TLS_CERT,
  [ENV_KEYS.MOCK_IMAGES]: process.env.MOCK_IMAGES,
  [ENV_KEYS.TOKEN_GITHUB]:
    process.env.NODE_ENV === "production" ? null : process.env.TOKEN_GITHUB,
  [ENV_KEYS.CODECOV_TOKEN]:
    process.env.NODE_ENV === "production" ? null : process.env.CODECOV_TOKEN,
};
