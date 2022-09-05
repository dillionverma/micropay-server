interface Config {
  host: string;
  dalleApiKey: string;
  supabaseUrl: string;
  supabaseApiKey: string;
  telegramToken: string;
  telegramUserId: string;
  awsAccessKey: string;
  awsSecretKey: string;
  adminMacaroon: string;
  tlsCert: string;
}

const config: Config = {
  host: process.env.HOST,
  dalleApiKey: process.env.DALLE_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseApiKey: process.env.SUPABASE_API_KEY,
  telegramToken: process.env.TELEGRAM_TOKEN,
  telegramUserId: process.env.TELEGRAM_USER_ID,
  awsAccessKey: process.env.AWS_ACCESS_KEY,
  awsSecretKey: process.env.AWS_SECRET_KEY,
  adminMacaroon: process.env.ADMIN_MACAROON,
  tlsCert: process.env.TLS_CERT,
};

export default config;
