import { Octokit } from "@octokit/core";
import {} from "@octokit/types";
import sodium from "libsodium-wrappers";

/**
 * This is a class that wraps the Octokit API to make it easier to work with
 */
export default class Github {
  private octokit;
  private owner: string;
  private repo: string;

  constructor(auth: string, owner: string, repo: string) {
    if (!auth) {
      throw new Error("No auth token provided");
    }
    if (!owner) {
      throw new Error("No owner provided");
    }
    if (!repo) {
      throw new Error("No repo provided");
    }

    this.octokit = new Octokit({ auth });
    this.owner = owner;
    this.repo = repo;
  }

  /**
   * Get all secrets from the Github CI
   */
  public async getAllSecrets(): Promise<any> {
    const { data: secrets } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/secrets",
      {
        owner: this.owner,
        repo: this.repo,
      }
    );

    for (const secret of secrets.secrets) {
      console.log(secret.name);
    }
  }

  /**
   * Update a secret in the Github CI
   * @param secret_name The name of the secret
   * @param secret_value The value of the secret
   * @returns
   */
  public async updateSecret(
    secret_name: string,
    secret_value: string
  ): Promise<void> {
    if (!secret_value) {
      console.log(`--- Skipping ${secret_name} because it is empty ---`);
      return;
    }

    console.log("Updating secret", secret_name, secret_value);
    const {
      data: { key, key_id },
    } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/secrets/public-key",
      {
        owner: this.owner,
        repo: this.repo,
      }
    );

    const encrypted_value = await this.encrypt(secret_value, key);

    await this.octokit.request(
      "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}",
      {
        owner: this.owner,
        repo: this.repo,
        secret_name,
        key_id,
        encrypted_value,
      }
    );
  }

  /**
   * Delete a secret from the Github CI
   * @param secret_name The name of the secret to delete
   */
  public async deleteSecret(secret_name: string): Promise<void> {
    await this.octokit.request(
      "DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}",
      {
        owner: this.owner,
        repo: this.repo,
        secret_name,
      }
    );
  }

  /**
   * Update all secrets in the Github CI to reflect local secrets
   * @param keys The keys to update
   */
  public async updateAllSecrets(keys: string[]): Promise<void> {
    for (const key of keys) {
      const value = process.env[key];
      await this.updateSecret(key, value);
    }
  }

  /**
   * Delete all secrets in the Github CI
   */
  public async deleteAllSecrets(): Promise<void> {
    const { data: secrets } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/actions/secrets",
      {
        owner: this.owner,
        repo: this.repo,
      }
    );

    for (const secret of secrets.secrets) {
      const secret_name = secret.name;
      console.log("Deleting secret", secret_name);
      await this.deleteSecret(secret_name);
    }
    console.log();
  }

  /**
   *
   * @param secret The secret to encrypt
   * @param key The key to encrypt the secret with
   * @returns The encrypted secret
   */
  private async encrypt(secret: string, key: string): Promise<string> {
    // Wait for sodium to be ready
    await sodium.ready;

    // Convert Secret & Base64 key to Uint8Array.
    let binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
    let binsec = sodium.from_string(secret);

    //Encrypt the secret using LibSodium
    let encBytes = sodium.crypto_box_seal(binsec, binkey);

    // Convert encrypted Uint8Array to Base64
    let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

    return output;
  }
}
