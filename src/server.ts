import { Job } from "bullmq";
import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express, { Request } from "express";
import rateLimit from "express-rate-limit";
import { StatusCodes } from "http-status-codes";
import { Config, config } from "./config";
import { generationQueue } from "./jobs/dalle2.job";
import { stableDiffusionQueue } from "./jobs/stableDiffusion.job";
import AWS from "./services/aws.services";
import Dalle2 from "./services/dalle2.service";
import Lightning from "./services/lightning.service";
import Sentry from "./services/sentry.service";
import Stability from "./services/stableDiffusion.service";
import { Order, supabase } from "./services/supabase.service";
import { TelegramBot } from "./services/telegram.service";
import Twitter from "./services/twitter.service";
import { getHost, sleep } from "./utils";

export const lightning = new Lightning(
  config.lndMacaroonInvoice,
  config.lndHost,
  config.lndPort
);

export const twitter = new Twitter(
  config.twitterAppKey,
  config.twitterAppSecret,
  config.twitterAccessToken,
  config.twitterAccessSecret
);

export const BUCKET_NAME = "dalle2-lightning";
// create a sha256 hash function
const sha256 = (data: string) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

const apiLimiter = rateLimit({
  windowMs: 12 * 60 * 60 * 1000, // 12 hour window
  max: 9, // Limit each IP to 9 requests per `window`
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

export const aws = new AWS(config.awsAccessKey, config.awsSecretKey);
export const dalle2 = new Dalle2(config.dalleApiKey, config.dalleSecretKey);
export const stability = new Stability(config.stabilityApiKey);

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
  WEBLN_WALLET_DETECTED = "WEBLN_WALLET_DETECTED",

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
  WEBLN_WALLET_DETECTED: "WebLN wallet detected! Waiting for confirmation",

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
  WEBLN_WALLET_DETECTED: 40,
  DALLE_GENERATING: 60,
  DALLE_UPLOADING: 80,
  DALLE_SAVING: 90,

  DALLE_FAILED: -1,
  INVOICE_CANCELLED: -1,
  USER_ERROR: -1,
  SERVER_ERROR: -1,
};

const sendMockImages = async (res, prompt) => {
  const images = [
    "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
    "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
    "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
    "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
  ];
  await res.status(StatusCodes.OK).send({
    status: ORDER_STATE.DALLE_GENERATED,
    message: MESSAGE.DALLE_GENERATED,
    images: images,
  });
};

export const init = (config: Config) => {
  const app = express();

  // RequestHandler creates a separate execution context using domains, so that every
  // transaction/span/breadcrumb is attached to its own Hub instance
  app.use(Sentry.Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler());

  app.use(cors({ credentials: true, origin: true }));
  app.set("trust proxy", true);
  app.use(cookieParser());

  app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
  app.use(express.json()); // parse application/json

  app.get("/", async (req, res) => {
    res.status(StatusCodes.OK).send("Hello World");
  });

  app.post(
    "/invoice",
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

        const { data, error } = await supabase
          .from<Order>("Orders")
          .insert([
            {
              invoice_id: invoice.id,
              invoice_request: invoice.request,
              satoshis: invoice.tokens,
              prompt: prompt,
              environment: process.env.NODE_ENV,
              model: "dalle",
            },
          ])
          .single();

        if (error) {
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ error: error.message });
        }

        const text = `
        🧾 New Order request
        ENV: ${process.env.NODE_ENV}
        Invoice Request: ${invoice.request}
        Invoice Tokens: ${invoice.tokens}
        Prompt: ${prompt}
        `;
        if (process.env.NODE_ENV === "production") {
          await telegramBot.sendMessageToAdmins(text);
        }
        console.log("Invoice generated: ", invoice);
        return res.status(StatusCodes.OK).send({
          id: invoice.id,
          uuid: data.uuid,
          request: invoice.request,
        });
      } catch (e) {
        console.log(e);
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: e.message });
      }
    }
  );

  app.post("/check-prompt", async (req, res) => {
    const { prompt } = req.body;
    const flagged = await dalle2.checkPrompt(prompt);
    res.status(StatusCodes.OK).send(flagged);
  });

  app.post(
    "/generate/stable-diffusion",
    apiLimiter,
    async (
      req: Request<unknown, unknown, { prompt: string }, unknown>,
      res
    ) => {
      if (!req.cookies.counter) {
        req.cookies.counter = 0;
      }

      const { prompt } = req.body;

      try {
        const { error, data } = await supabase
          .from<Order>("Orders")
          .insert([
            {
              prompt: prompt,
              environment: process.env.NODE_ENV,
              model: "stable-diffusion",
            },
          ])
          .single();

        if (error) {
          return res
            .status(StatusCodes.INTERNAL_SERVER_ERROR)
            .send({ error: error.message });
        }

        // read counter variable from cookie
        if (req.cookies.counter >= 3)
          return res.status(StatusCodes.FORBIDDEN).send({
            error: "You have reached your limit of 3 requests",
          });

        const job = await stableDiffusionQueue.add(
          "generate",
          {
            prompt,
          },
          { jobId: data.uuid }
        );

        res.cookie("counter", parseInt(req.cookies.counter) + 1, {
          maxAge: 315360000000,
          sameSite: "none",
        });

        return res.status(200).send({
          status: "success",
          message: "Generation started... GET $url to monitor progress",
          id: data.uuid,
          url:
            getHost(req) +
            "/generate/stable-diffusion/" +
            data.uuid +
            "/status",
        });
      } catch (e) {
        console.log(e);
        return res.status(500).send({ error: e.message });
      }
    }
  );

  app.get(
    "/generate/stable-diffusion/:id/status",
    async (req: Request<{ id: string }, unknown, unknown, unknown>, res) => {
      const { id } = req.params;
      try {
        const { data: order, error } = await supabase
          .from<Order>("Orders")
          .select("*")
          .match({ uuid: id })
          .limit(1)
          .single();

        return res.status(200).send({
          message: "Generating Images",
          images: order?.results || [],
        });
      } catch (e) {
        console.log(e);
        return res.status(500).send({ error: e.message });
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
      "a male mannequin dressed in an orange and black flannel shirt and black jeans",
      "a female mannequin dressed in a black leather jacket and hold pleated skirt",
      "a living room with two white armchairs and a painting of the colosseum. the painting is mounted above a modern fireplace.",
      "a loft bedroom with a white bed next to a nightstand. there is a fish tank beside the bed.",
    ];
    const i = Math.floor(Math.random() * prompts.length);

    let prompt = prompts[i];

    try {
      let flagged = await dalle2.checkPrompt(prompt);
      if (flagged) {
        const ERROR_MESSAGE =
          "Prompt is flagged by OpenAI's moderation system: ";
        res.status(StatusCodes.BAD_REQUEST).send({ error: ERROR_MESSAGE });
      } else {
        if (process.env.MOCK_IMAGES === "true") {
          return sendMockImages(res, prompt);
        } else {
          const images = await dalle2.generate(prompt);
          console.log(images);
          return res.status(StatusCodes.OK).send({ images });
        }
      }
    } catch (e) {
      if (e.error) {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: JSON.stringify(e.error, null, 2) });
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
        { uuid: string; rating: number; feedback: string; email: string },
        unknown
      >,
      res
    ) => {
      const { uuid, rating, feedback, email } = req.body;
      // Update order to indicate that images have been generated
      const { data: updatedOrder, error } = await supabase
        .from<Order>("Orders")
        .update({ rating, feedback, email })
        .match({ uuid })
        .single();

      if (error) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .send({ error: error.message });
      }

      const feedbackText = `
      🗣 User Feedback Received: 
      Unique ID: ${uuid.slice(0, 10)}
      Feedback: ${feedback}
      Rating: ${rating}
      Email: ${email}
      `;

      if (process.env.NODE_ENV === "production") {
        await telegramBot.sendMessageToAdmins(feedbackText);
        console.log(feedbackText);
      }

      return res.status(StatusCodes.OK).send({
        status: "success",
      });
    }
  );

  //Write a function to accept a GET request for config.mockImages value from the config file
  app.get("/mock-images", async (req, res) => {
    if (process.env.NODE_ENV === "development") {
      res.status(StatusCodes.OK).send(config.mockImages);
    }
  });

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
  app.get("/generate/:id/status", async (req, res) => {
    const { id } = req.params;
    const webln = req.query.webln == "true";

    try {
      // get invoice from lnd
      const invoice = await lightning.getInvoice(id);

      // Check if invoice found (sanity check)
      if (!invoice)
        return res.status(StatusCodes.NOT_FOUND).send({
          status: ORDER_STATE.INVOICE_NOT_FOUND,
          message: MESSAGE.INVOICE_NOT_FOUND,
        });

      if (webln && !invoice.is_confirmed) {
        console.log({
          status: ORDER_STATE.WEBLN_WALLET_DETECTED,
          message: MESSAGE.WEBLN_WALLET_DETECTED,
          progress: ORDER_PROGRESS.WEBLN_WALLET_DETECTED,
          invoice: invoice.request,
        });
        return res.status(StatusCodes.OK).send({
          status: ORDER_STATE.WEBLN_WALLET_DETECTED,
          message: MESSAGE.WEBLN_WALLET_DETECTED,
          progress: ORDER_PROGRESS.WEBLN_WALLET_DETECTED,
        });
      }
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
          const images = [
            "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
            "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
            "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
            "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
          ];

          return res.status(StatusCodes.OK).send({
            status: ORDER_STATE.DALLE_GENERATED,
            message: MESSAGE.DALLE_GENERATED,
            images: images,
          });
        }

        let job: Job;
        // 4. If invoice has been paid, check the generation queue
        job = await generationQueue.getJob(id);

        // 3. If image has not been generated, check if invoice has been paid
        if (invoice.is_confirmed) {
          if (process.env.MOCK_IMAGES === "true") {
            await sleep(2000);
            return sendMockImages(res, order.prompt);
          }

          if (!job) {
            // 5. If job is not in queue, add it to the queue
            job = await generationQueue.add(
              "generate",
              {
                prompt: order.prompt,
              },
              { jobId: id }
            );
          }
          await job.updateProgress(ORDER_PROGRESS.DALLE_GENERATING);
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
  });

  app.use(Sentry.Handlers.errorHandler());

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  return app;
};
