import { exit } from "process";
import { ENV_KEYS } from "../src/config";
import Github from "../src/services/github.service";

const envFile = ".env.test";
const owner = "dillionverma";
const repo = "micropay-server";

if (process.env.NODE_ENV === "production") {
  console.log("This script should not be run in production.");
  exit(1);
}

// Get the secrets from the environment
require("dotenv-safe").config({ path: envFile, allowEmptyValues: true }); // only ".env.test"

(async () => {
  const github = new Github(process.env.GITHUB_CI_TOKEN, owner, repo);

  // Delete all existing secrets
  await github.deleteAllSecrets();

  // Update all secrets to reflect local secrets in .env.test
  await github.updateAllSecrets(Object.keys(ENV_KEYS));
})();
