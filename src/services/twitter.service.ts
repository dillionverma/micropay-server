import { TwitterApi } from "twitter-api-v2";

export default class Twitter {
  private client: TwitterApi;

  constructor(
    appKey: string,
    appSecret: string,
    accessToken: string,
    accessSecret: string
  ) {
    this.client = new TwitterApi({
      appKey,
      appSecret,
      accessToken,
      accessSecret,
    });
  }

  async tweet(text: string): Promise<void> {
    try {
      const data = await this.client.readWrite.v1.tweet(text);
      console.log(data);
    } catch (error) {
      console.log(error);
    }
  }
}
