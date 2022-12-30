import { Configuration, OpenAIApi } from "openai";

export type ImageSize = "256x256" | "512x512" | "1024x1024";

export default class OpenAI {
  private configuration: Configuration;
  private openai: OpenAIApi;

  constructor(apiKey: string) {
    this.configuration = new Configuration({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.openai = new OpenAIApi(this.configuration);
  }

  async createImage(
    prompt: string,
    n: number = 1,
    size: ImageSize = "1024x1024"
  ): Promise<string[]> {
    const response = await this.openai.createImage({
      prompt,
      n,
      size,
    });
    return response.data.data.map((img) => img.url);
  }
}
