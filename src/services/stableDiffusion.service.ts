import { generateAsync } from "stability-client";
import { config } from "../config";
import { aws } from "../server";

// https://github.com/vpzomtrrfrt/stability-client
// This library was chosen since it was only functional one I found after a quick search

interface StabilityResponse {
  buffer: Buffer;
  filePath: string;
  seed: number;
  mimeType: string;
  classications: {
    realizedAction: number;
  };
}

export default class Stability {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(prompt: string): Promise<string[]> {
    // Random default parameters - can be changed
    const { res, images } = await generateAsync({
      prompt,
      apiKey: this.apiKey,
      steps: 50,
      cfgScale: 15,
      diffusion: "k_euler_ancestral",
      samples: 1,
      seed: Math.floor(Math.random() * (Math.pow(2, 31) - 1)),
    });

    // Upload images to S3
    const urls: string[] = await Promise.all(
      images.map((image: StabilityResponse) =>
        aws.uploadImageBufferToS3(
          image.buffer,
          image.filePath.split("/").pop(),
          config.awsStableDiffusionBucketName
        )
      )
    );

    return urls;
  }
}
