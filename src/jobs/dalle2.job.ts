import { Job, Queue, Worker } from "bullmq";
import { GetInvoiceResult } from "lightning";

import { config } from "../config";
import {
  aws,
  dalle2,
  lightning,
  MESSAGE,
  ORDER_PROGRESS,
  ORDER_STATE,
  telegramBot,
} from "../server";
import { GenerateResponse } from "../services/dalle2.service";
import { connection } from "../services/redis.service";
import { Order, supabase } from "../services/supabase.service";

// Core assumptions of this code is that
// job.id === invoice.id

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
    console.log("Starting job", job.id);
    const { prompt } = job.data;
    // invoice id
    const { id } = job;

    await updateJobStatus(job, ORDER_STATE.INVOICE_NOT_PAID);

    let invoice: GetInvoiceResult;
    if (process.env.NODE_ENV !== "test") {
      // Get invoice from lnd
      console.log("getting invoice");
      invoice = await lightning.getInvoice(id);

      // Check if invoice exists (sanity check)
      if (!invoice) throw "Invoice not found";

      // Check if invoice is paid (sanity check)
      if (!invoice.is_confirmed) throw "Invoice not paid";
    }

    // Generate images
    await updateJobStatus(job, ORDER_STATE.DALLE_GENERATING);
    const dalleImages = await dalle2.generate(prompt);
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
    if (process.env.NODE_ENV !== "test") {
      const { data: updatedOrder, error } = await supabase
        .from<Order>("Orders")
        .update({ results: images })
        .match({ invoice_id: job.id })
        .single();

      if (error) {
        console.error(error);
        throw error;
      }
    }

    // Send telegram message
    const text = `
      Received new order!
      Prompt: "${prompt}"
      Invoice ID: ${invoice?.id}
      Satoshis: ${invoice?.tokens}
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
  console.log(`Job ${job.id} failed with ${err}`);
});
