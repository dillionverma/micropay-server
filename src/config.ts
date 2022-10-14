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
}

export const config: Config = {
  host: process.env.HOST,
  port: process.env.PORT || 3002,
  dalleApiKey: process.env.DALLE_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseApiKey: process.env.SUPABASE_API_KEY,
  personalTelegramToken: process.env.PERSONAL_TELEGRAM_TOKEN,
  groupTelegramToken: process.env.GROUP_TELEGRAM_TOKEN,
  telegramUserId: process.env.TELEGRAM_USER_ID,
  telegramUserIdHaseab: process.env.TELEGRAM_USER_ID_HASEAB,
  telegramGroupId: process.env.TELEGRAM_GROUP_ID,
  sentryDsn: process.env.SENTRY_DSN,
  awsAccessKey: process.env.AWS_ACCESS_KEY,
  awsSecretKey: process.env.AWS_SECRET_KEY,
  adminMacaroon:
    process.env.NODE_ENV === "production" ? null : process.env.ADMIN_MACAROON, // safety check. No admin macaroon in production
  readOnlyMacaroon: process.env.READ_ONLY_MACAROON,
  invoiceMacaroon: process.env.INVOICE_MACAROON,
  tlsCert: process.env.TLS_CERT,
  mockImages: process.env.MOCK_IMAGES,
};
