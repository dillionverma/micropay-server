import { Job, Queue, Worker } from "bullmq";

import { config } from "../config";
import { stability } from "../server";
import { connection } from "../services/redis.service";
import { Order, supabase } from "../services/supabase.service";

export interface GenerateJob {
  prompt: string;
}

export const stableDiffusionQueue = new Queue<GenerateJob>(
  config.stableDiffusionQueueName,
  {
    connection,
  }
);

// Core assumptions of this code is that
// job.id === order.uuid

export const stableDiffusionWorker = new Worker<GenerateJob>(
  config.stableDiffusionQueueName,
  async (job: Job) => {
    console.log("Starting job", job.id);
    const { prompt } = job.data;
    try {
      const urls = await stability.generate(prompt);
      console.log(urls);

      const { data, error } = await supabase
        .from<Order>("Orders")
        .update({ results: urls })
        .match({ uuid: job.id })
        .single();

      if (error) {
        console.error(error);
        throw error;
      }
      return urls;
    } catch (e) {
      console.log(e);
    }
  }
);
