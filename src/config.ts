interface Config {
  myEnvVar: string;
}

const config: Config = {
  myEnvVar: process.env.MY_ENV_VAR,
};

export default config;
