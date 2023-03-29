import axios from "axios";
import { Job, Queue, Worker } from "bullmq";
import { GetInvoiceResult } from "lightning";
import { v4 as uuidv4 } from "uuid";

import { config } from "../config";
import {
  aws,
  lightning,
  MESSAGE,
  openai,
  ORDER_PROGRESS,
  ORDER_STATE,
  telegramBot,
  twitter,
} from "../server";
import { connection } from "../services/redis.service";
import { Order, supabase } from "../services/supabase.service";

// Core assumptions of this code is that
// job.id === invoice.uuid

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
    const { id } = job; // uuid

    await updateJobStatus(job, ORDER_STATE.INVOICE_NOT_PAID);

    let invoice: GetInvoiceResult;
    if (process.env.NODE_ENV !== "test") {
      // Get invoice from lnd
      console.log("getting invoice");
      invoice = await lightning.getInvoice(id);

      // Check if invoice exists (sanity check)
      if (!invoice) throw "Invoice not found";

      // Check if invoice is paid (sanity check)
      if (!invoice.is_held) throw "Invoice not paid";
    }

    // Job failing test to see if payment is refunded
    // job.discard();
    // await lightning.cancelHodlInvoice(invoice.id);
    // await updateJobStatus(job, ORDER_STATE.DALLE_FAILED);
    // throw "failed";

    let images: string[];

    try {
      // Generate images
      await updateJobStatus(job, ORDER_STATE.DALLE_GENERATING);
      const dalleImages = await openai.createImage(prompt, 4);
      await updateJobStatus(job, ORDER_STATE.DALLE_UPLOADING);

      // Get image buffers
      const imageBuffers = await Promise.all(
        dalleImages.map(async (url) => {
          const response = await axios(url, {
            method: "GET",
            responseType: "arraybuffer",
          });
          return response.data;
        })
      );

      // Upload buffers to AWS
      images = await Promise.all(
        imageBuffers.map((buffer) =>
          aws.uploadImageBufferToS3(
            config.awsDalleBucketName,
            buffer,
            `${uuidv4()}`,
            "png"
          )
        )
      );
    } catch {
      console.error("Image generation failed");
    }

    if (images.length === 0) {
      await lightning.cancelHodlInvoice(invoice.id);
    }

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

      // Only actively held invoices can be settled
      if (invoice.is_held) {
        // Use the secret to claim the funds
        await lightning.settleHodlInvoice(updatedOrder.invoice_preimage);
      }

      // Send telegram message
      const text = `
      💰 RECEIVED NEW ORDER!
      Prompt: "${prompt}"
      Invoice ID: ${invoice?.id}
      Satoshis: ${invoice?.tokens}
      `;

      try {
        await telegramBot.sendImagesToGroup(images, prompt);
        await telegramBot.sendMessageToAdmins(text);
        await twitter.tweetImages(images, prompt);
      } catch (e) {
        console.error("Posting to telegram failed");
        console.error(e);
      }
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
