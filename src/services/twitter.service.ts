import axios from "axios";
import { TwitterApi } from "twitter-api-v2";
import { sleep } from "../utils";
import nlp from "compromise";

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

  tokenizePrompt(prompt) {
    let doc = nlp(prompt);
    const tokenized = [];
    doc
      .nouns()
      .json()
      .map((n) => {
        console.log();
        for (const term of n.terms) {
          if (
            term.tags.includes("Noun") ||
            term.tags.includes("Adjective") ||
            term.tags.includes("Verb")
          ) {
            tokenized.push(term.normal);
          }
        }
      });
    return tokenized;
  }

  async tweet(text: string): Promise<void> {
    try {
      const data = await this.client.readWrite.v1.tweet(text);
      console.log(data);
    } catch (error) {
      console.log(error);
    }
  }

  async tweetImages(images: string[], prompt: string): Promise<void> {
    const nouns = this.tokenizePrompt(prompt);
    const promptHashtags = "#" + nouns.join(" #");
    prompt +=
      " (Generated at https://micropay.ai) \n\n#micropayment #dalle2 #art #AI ";
    prompt += promptHashtags;
    let mediaIds: string[] = [];
    await images.map(async (image) => {
      const response = await axios.get(image, {
        responseType: "arraybuffer",
      });
      const buf = Buffer.from(response.data, "binary");
      const id = await this.client.readWrite.v1.uploadMedia(buf, {
        mimeType: "image/webp",
      });
      console.log(id);
      mediaIds.push(id);
    });
    await sleep(5000);
    // console.log("mediaIds", mediaIds);
    try {
      const data = await this.client.readWrite.v1.tweet(prompt, {
        media_ids: mediaIds,
      });
      console.log(data);
    } catch (error) {
      console.log(error);
    }
  }
}
