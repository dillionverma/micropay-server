interface Config {
  host: string;
  dalleApiKey: string;
  supabaseUrl: string;
  supabaseApiKey: string;
  personalTelegramToken: string;
  groupTelegramToken: string;
  telegramUserId: string;
  telegramGroupId: string;
  sentryDsn: string;
  awsAccessKey: string;
  awsSecretKey: string;
  adminMacaroon: string;
  tlsCert: string;
  openaiApiKey: string;
  lndSocket: string;
  sessionSecret: string;
}

const config: Config = {
  host: process.env.HOST,
  dalleApiKey: process.env.DALLE_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseApiKey: process.env.SUPABASE_API_KEY,
  personalTelegramToken: process.env.PERSONAL_TELEGRAM_TOKEN,
  groupTelegramToken: process.env.GROUP_TELEGRAM_TOKEN,
  telegramUserId: process.env.TELEGRAM_USER_ID,
  telegramGroupId: process.env.TELEGRAM_GROUP_ID,
  sentryDsn: process.env.SENTRY_DSN,
  awsAccessKey: process.env.AWS_ACCESS_KEY,
  awsSecretKey: process.env.AWS_SECRET_KEY,
  adminMacaroon: process.env.LND_MACAROON,
  tlsCert: process.env.LND_TLS_CERT,
  openaiApiKey: process.env.OPENAI_API_KEY,
  lndSocket: process.env.LND_SOCKET,
  sessionSecret: process.env.SESSION_SECRET,
};

export default config;
