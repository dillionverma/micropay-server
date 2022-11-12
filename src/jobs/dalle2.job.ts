import { Job, Queue, Worker } from "bullmq";
import { findOrderByUUID } from "./../db/orders";

import { config } from "../config";
import { updateOrder } from "../db/orders";
import {
  aws,
  dalle2,
  MESSAGE,
  ORDER_PROGRESS,
  ORDER_STATE,
  telegramBot,
} from "../server";
import { GenerateResponse } from "../services/dalle2.service";
import { connection } from "../services/redis.service";

// Core assumptions of this code is that
// job.id === order.uuid

export interface GenerateJob {
  prompt: string;
  status?: ORDER_STATE;
  message?: string;
}

export const generationQueue = new Queue<GenerateJob>(config.dalleQueueName, {
  connection,
});

const updateJobStatus = async (
  job: Job<GenerateJob>,
  state: ORDER_STATE
): Promise<void> => {
  await job.updateProgress(ORDER_PROGRESS[state]);
  await job.update({
    ...job.data,
    status: ORDER_STATE[state],
    message: MESSAGE[state],
  });
};

export const generationWorker = new Worker<GenerateJob>(
  config.dalleQueueName,
  async (job: Job) => {
    // return "success";
    console.log("Starting job", job.id);
    const { prompt } = job.data;
    const { id } = job; // uuid

    const order = await findOrderByUUID(id);

    // Generate images
    await updateJobStatus(job, ORDER_STATE.DALLE_GENERATING);

    let dalleImages;
    if (process.env.NODE_ENV === "test") {
      dalleImages = [
        "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
        "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
        "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
        "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
      ];
    } else {
      dalleImages = await dalle2.generate(prompt);
    }
    await updateJobStatus(job, ORDER_STATE.DALLE_UPLOADING);

    // Upload images to S3
    const images: string[] = await Promise.all(
      dalleImages.map((image: GenerateResponse) =>
        aws.uploadImageBufferToS3(
          image.imageBuffer,
          `${image.generationId}.png`
        )
      )
    );

    console.log(images);
    await updateJobStatus(job, ORDER_STATE.DALLE_SAVING);

    // Update order to indicate that images have been generated
    // if (process.env.NODE_ENV !== "test") {
    const updatedOrder = await updateOrder(id, { results: images });
    console.log(updatedOrder);
    // }

    // Send telegram message
    const text = `
      Received new order!
      Prompt: "${prompt}"
      Satoshis: ${order.satoshis}
      `;

    try {
      await telegramBot.sendImagesToGroup(images, prompt);
      await telegramBot.sendMessageToAdmins(text);
    } catch (e) {
      console.error("Posting to telegram failed");
      console.error(e);
    }
  },
  {
    connection,
    concurrency: parseInt(config.dalleQueueConcurrency),
  }
);

generationWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed!`);
});

generationWorker.on("failed", (job, err) => {
  console.log(`Job ${job.id} failed with ${JSON.stringify(err)}`);
});
