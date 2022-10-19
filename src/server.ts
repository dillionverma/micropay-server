import { Job } from "bullmq";
import cors from "cors";
import express, { Request } from "express";
import { StatusCodes } from "http-status-codes";
import { Config, config } from "./config";
import { generationQueue } from "./jobs/dalle2.job";
import AWS from "./services/aws.services";
import Dalle2 from "./services/dalle2.service";
import Lightning from "./services/lightning.service";
import Sentry from "./services/sentry.service";
import { Order, supabase } from "./services/supabase.service";
import { TelegramBot } from "./services/telegram.service";
import { sleep } from "./utils";

export const lightning = new Lightning(
  config.lndMacaroonInvoice,
  config.lndHost,
  config.lndPort
);

export const BUCKET_NAME = "dalle2-lightning";
export const aws = new AWS(
  config.awsAccessKey,
  config.awsSecretKey,
  BUCKET_NAME
);
export const dalle2 = new Dalle2(config.dalleApiKey);

export const telegramBot = new TelegramBot(
  config.telegramPrivateNotifierBotToken,
  config.telegramGenerationsBotToken,
  [config.telegramUserIdDillion, config.telegramUserIdHaseab],
  config.telegramGroupIdMicropay
);

const DEFAULT_PRICE = process.env.NODE_ENV === "production" ? 1000 : 50;

export enum ORDER_STATE {
  INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND",
  INVOICE_NOT_PAID = "INVOICE_NOT_PAID",

  DALLE_GENERATING = "DALLE_GENERATING",
  DALLE_UPLOADING = "DALLE_UPLOADING",
  DALLE_SAVING = "DALLE_SAVING",
  DALLE_GENERATED = "DALLE_GENERATED",
  DALLE_FAILED = "DALLE_FAILED",

  INVOICE_CANCELLED = "INVOICE_CANCELLED",
  USER_ERROR = "USER_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  REFUND_RECIEVED = "REFUND_RECIEVED",
}

export const MESSAGE: { [key in ORDER_STATE]: string } = {
  INVOICE_NOT_FOUND: "Invoice not found",
  INVOICE_NOT_PAID: "Order received! Waiting for payment...",

  DALLE_GENERATING: "Invoice paid! Dalle-2 is currently generating images...",
  DALLE_UPLOADING: "Images generated! Uploading images to cloud...",
  DALLE_SAVING: "last change",
  DALLE_GENERATED: "Dalle-2 has generated images.",
  DALLE_FAILED: "Dalle-2 failed to generate images.",

  INVOICE_CANCELLED: "Invoice was cancelled",
  USER_ERROR: "An error occured",
  SERVER_ERROR: "An error occured on the server",
  REFUND_RECIEVED: "Refund recieved",
};

export const ORDER_PROGRESS: { [key in ORDER_STATE]?: number } = {
  INVOICE_NOT_FOUND: 0,

  INVOICE_NOT_PAID: 20,
  DALLE_GENERATING: 60,
  DALLE_UPLOADING: 80,
  DALLE_SAVING: 90,

  DALLE_FAILED: -1,
  INVOICE_CANCELLED: -1,
  USER_ERROR: -1,
  SERVER_ERROR: -1,
};

export const init = (config: Config) => {
  const app = express();

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());

  app.use(cors());
  app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
  app.use(express.json()); // parse application/json

  app.get("/", async (req, res) => {
    res.status(StatusCodes.OK).send("Hello World");
  });

  app.post(
    "/generate",
    async (
      req: Request<unknown, unknown, { prompt: string }, unknown>,
      res
    ) => {
      const { prompt } = req.body;

      const isValid = await dalle2.isTokenValid();
      const text =
        process.env.NODE_ENV === "production"
          ? "Production: OpenAI Token expired"
          : "Dev: Open AI Token expired";
      if (!isValid) {
        await telegramBot.sendMessageToAdmins(text);
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: "Dalle token has expired" });
      }

      try {
        // https://bitcoin.stackexchange.com/questions/85951/whats-the-maximum-size-of-the-memo-in-a-ln-payment-request
        const invoice = await lightning.createInvoice(
          `Dalle-2 generate: "${prompt.substring(0, 300)}"`,
          DEFAULT_PRICE
        );

        const { error } = await supabase.from("Orders").insert([
          {
            invoice_id: invoice.id,
            invoice_request: invoice.request,
            satoshis: invoice.tokens,
            prompt: prompt,
            environment: process.env.NODE_ENV,
          },
        ]);

        if (error) {
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ error: error.message });
        }

        const text = `
        New Order request
        ENV: ${process.env.NODE_ENV}
        Invoice Request: ${invoice.request}
        Invoice Tokens: ${invoice.tokens}
        Prompt: ${prompt}
        `;

        await telegramBot.sendMessageToAdmins(text);
        console.log("Invoice generated: ", invoice);
        return res.status(StatusCodes.OK).send(invoice);
      } catch (e) {
        console.log(e);
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: e.message });
      }
    }
  );

  app.get("/dalle2-test", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send({ error: "Not allowed" });
    }

    // Generate images
    const prompts = [
      "a store front that has the word 'openai' written on it",
      "an armchair in the shape of an avocado",
      "a person wearing a mask and holding a sign that says 'I'm vaccinated'",
      "a male mannequin dressed in an orange and black flannel shirt and black jeans",
      "a female mannequin dressed in a black leather jacket and hold pleated skirt",
      "a living room with two white armchairs and a painting of the colosseum. the painting is mounted above a modern fireplace.",
      "a loft bedroom with a white bed next to a nightstand. there is a fish tank beside the bed.",
    ];

    const vulgurPrompt = "test swearword: fuck giraffe (please don't ban)";
    const i = Math.floor(Math.random() * prompts.length);

    try {
      const images = await dalle2.generate(prompts[i]);
      // const images = await dalle2.generate(vulgurPrompt);
      console.log(images);
      res.status(StatusCodes.OK).send({ images });
    } catch (e) {
      if (e.error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: e.error });
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).send({ error: e });
    }
  });

  app.post(
    "/subscribe",
    async (req: Request<unknown, unknown, { email: string }, unknown>, res) => {
      const { email } = req.body;
      const { data, error } = await supabase.from("subscribers").insert([
        {
          email,
        },
      ]);

      return res.status(StatusCodes.OK).send({
        status: "success",
      });
    }
  );

  app.post(
    "/feedback",
    async (
      req: Request<
        unknown,
        unknown,
        { invoiceId: string; rating: number; feedback: string },
        unknown
      >,
      res
    ) => {
      const { invoiceId, rating, feedback } = req.body;
      // Update order to indicate that images have been generated
      const { data: updatedOrder, error } = await supabase
        .from<Order>("Orders")
        .update({ rating, feedback })
        .match({ invoice_id: invoiceId })
        .single();

      if (error) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: error.message });
      }

      return res.status(StatusCodes.OK).send({
        status: "success",
      });
    }
  );

  app.post(
    "/refund",
    async (
      req: Request<
        unknown,
        unknown,
        { invoiceId: string; refundInvoice: string },
        unknown
      >,
      res
    ) => {
      const { invoiceId, refundInvoice } = req.body;

      // Update order to indicate that refund transaction recieved
      const { data: updatedOrder, error } = await supabase
        .from<Order>("Orders")
        .update({ refundInvoice })
        .match({ invoice_id: invoiceId })
        .single();

      if (error) {
        console.log("Error updating order: ", error);
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ status: ORDER_STATE.SERVER_ERROR, message: error.message });
      }

      await telegramBot.sendMessageToAdmins(
        "Refund request recieved for " + invoiceId
      );

      await telegramBot.sendMessageToAdmins(refundInvoice);

      return res.status(StatusCodes.OK).send({
        status: ORDER_STATE.REFUND_RECIEVED,
        message: MESSAGE.REFUND_RECIEVED,
      });
    }
  );

  /*

  Flow:
  1. User enters prompt
  2. Request is sent to server POST /generate
  3. Server generates invoice
  4. Server sends invoice to user
  5. User pays invoice
  6. Server recieves payment
  7. Server generates images
  8. Server sends images to user
  */

  /**
   * @param {string} id - Invoice id
   */
  app.get(
    "/generate/:id/status",
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const { id } = req.params;

      try {
        // get invoice from lnd
        const invoice = await lightning.getInvoice(id);

        // Check if invoice found (sanity check)
        if (!invoice)
          return res.status(StatusCodes.NOT_FOUND).send({
            status: ORDER_STATE.INVOICE_NOT_FOUND,
            message: MESSAGE.INVOICE_NOT_FOUND,
          });

        // Check if invoice is paid
        if (!invoice.is_confirmed) {
          console.log({
            status: ORDER_STATE.INVOICE_NOT_PAID,
            message: MESSAGE.INVOICE_NOT_PAID,
            progress: ORDER_PROGRESS.INVOICE_NOT_PAID,
            invoice: invoice.request,
          });
          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.INVOICE_NOT_PAID,
            message: MESSAGE.INVOICE_NOT_PAID,
            progress: ORDER_PROGRESS.INVOICE_NOT_PAID,
          });
        }

        // 1. Check if image has already been generated
        const { data: order, error } = await supabase
          .from<Order>("Orders")
          .select("*")
          .match({ invoice_id: id })
          .limit(1)
          .single();

        if (error) {
          console.error("Error getting order: ", error);
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ status: ORDER_STATE.SERVER_ERROR, message: error.message });
        }

        // 2. If image has been generated, send it to user
        if (order.results) {
          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.DALLE_GENERATED,
            message: MESSAGE.DALLE_GENERATED,
            progress: ORDER_PROGRESS.DALLE_GENERATED,
            images: order.results,
          });
        }

        let job: Job;
        // 4. If invoice has been paid, check the generation queue
        job = await generationQueue.getJob(id);

        // 3. If image has not been generated, check if invoice has been paid
        if (invoice.is_confirmed) {
          if (process.env.MOCK_IMAGES === "true") {
            await sleep(2000);
            return res.status(StatusCodes.OK).send({
              status: ORDER_STATE.DALLE_GENERATED,
              message: MESSAGE.DALLE_GENERATED,
              images: [
                "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
                "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
                "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
                "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
              ],
            });
          }

          if (!job) {
            // 5. If job is not in queue, add it to the queue
            job = await generationQueue.add(
              "generate",
              {
                prompt: order.prompt,
              },
              {
                attempts: 5, // Something else is most likely wrong at this point
                backoff: {
                  type: "fixed",
                  delay: 2000,
                },
                jobId: id,
              }
            );
            await job.updateProgress(ORDER_PROGRESS.INVOICE_NOT_PAID);
            await job.update({
              ...job.data,
              message: MESSAGE.DALLE_GENERATING,
            });
          }

          // 6. If job is in queue, but not done, send progress
          return res.status(StatusCodes.OK).send({
            status: job.data.status,
            message: job.data.message,
            progress: job.progress,
            images: [],
          });
        } else if (invoice.is_canceled) {
          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.INVOICE_CANCELLED,
            message: MESSAGE.INVOICE_CANCELLED,
            progress: ORDER_PROGRESS.INVOICE_CANCELLED,
          });
        } else {
          console.error("SERVER ERROR 1");
          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.SERVER_ERROR,
            message: MESSAGE.SERVER_ERROR,
            progress: ORDER_PROGRESS.SERVER_ERROR,
          });
        }
      } catch (e) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: e.message });
      }
    }
  );

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  return app;
};
