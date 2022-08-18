interface Config {
  smspoolApiKey: string;
}

const config: Config = {
  smspoolApiKey: process.env.SMS_POOL_API_KEY,
};

export default config;
