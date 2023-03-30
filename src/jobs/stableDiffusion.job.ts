import { Job, Queue, Worker } from "bullmq";

import { config } from "../config";
import { stability, telegramBot } from "../server";
import { connection } from "../services/redis.service";
import { Order, supabase } from "../services/supabase.service";

export interface StableDiffusionGenerateJob {
  prompt: string;
}

export const stableDiffusionQueue = new Queue<StableDiffusionGenerateJob>(
  config.stableDiffusionQueueName,
  {
    connection,
  }
);

// Core assumptions of this code is that
// job.id === order.uuid

export const stableDiffusionWorker = new Worker<StableDiffusionGenerateJob>(
  config.stableDiffusionQueueName,
  async (job: Job) => {
    console.log("Starting job", job.id);
    const { prompt } = job.data;
    try {
      const urls = await stability.generate(prompt);
      console.log(urls);

      if (process.env.NODE_ENV !== "test") {
        const { data, error } = await supabase
          .from<Order>("Orders")
          .update({ results: urls })
          .match({ uuid: job.id })
          .single();

        if (error) {
          console.error(error);
          throw error;
        }

        // Send telegram message
        const text = `
        🖌️ Received new free generation:
        Prompt: "${prompt}"
        `;

        try {
          await telegramBot.sendImagesToGroup(urls, prompt);
          await telegramBot.sendMessageToAdmins(text);
        } catch (e) {
          console.error("Posting to telegram failed");
          console.error(e);
        }
      }

      return urls;
    } catch (e) {
      console.log(e);
    }
  },
  {
    connection,
  }
);
