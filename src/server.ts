import cors from "cors";
import express, { Request } from "express";
import lnService from "lightning";
import { Config, config } from "./config";
import { BUCKET_NAME, uploadFileToS3 } from "./s3";
import Sentry from "./sentry";
import { Dalle2 } from "./services/dalle2";
import { TelegramBot } from "./services/telegramBot";
import { Order, supabase } from "./supabase";

const { invoiceMacaroon: macaroon, host } = config;
const socket = `${host}:10009`;
const { lnd } = lnService.authenticatedLndGrpc({
  macaroon,
  socket,
});

const dalle2 = new Dalle2(config.dalleApiKey);

const telegramBot = new TelegramBot(
  config.personalTelegramToken,
  config.groupTelegramToken,
  [config.telegramUserId, config.telegramUserIdHaseab],
  config.telegramGroupId
);

const DEFAULT_PRICE = process.env.NODE_ENV === "production" ? 1000 : 50;

enum state {
  INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND",
  INVOICE_NOT_PAID = "INVOICE_NOT_PAID",
  DALLE_GENERATING = "DALLE_GENERATING",
  DALLE_GENERATED = "DALLE_GENERATED",
  DALLE_FAILED = "DALLE_FAILED",
  INVOICE_CANCELLED = "INVOICE_CANCELLED",
  USER_ERROR = "USER_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  REFUND_RECIEVED = "REFUND_RECIEVED",
}

const MESSAGE: { [key in state]: string } = {
  INVOICE_NOT_FOUND: "Invoice not found",
  INVOICE_NOT_PAID: "Invoice not paid yet",
  DALLE_GENERATING: "Invoice paid! Dalle-2 is currently generating images...",
  DALLE_GENERATED: "Dalle-2 has generated images.",
  DALLE_FAILED: "Dalle-2 failed to generate images.",
  INVOICE_CANCELLED: "Invoice was cancelled",
  USER_ERROR: "An error occured",
  SERVER_ERROR: "An error occured on the server",
  REFUND_RECIEVED: "Refund recieved",
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
    res.status(200).send("Hello World");
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
        return res.status(500).send({ error: "Dalle token has expired" });
      }

      try {
        // https://bitcoin.stackexchange.com/questions/85951/whats-the-maximum-size-of-the-memo-in-a-ln-payment-request
        const invoice = await lnService.createInvoice({
          lnd,
          description: `Dalle-2 generate: "${prompt.substring(0, 300)}"`,
          tokens: DEFAULT_PRICE,
        });

        const { data, error } = await supabase.from("Orders").insert([
          {
            invoice_id: invoice.id,
            invoice_request: invoice.request,
            satoshis: invoice.tokens,
            prompt: prompt,
            environment: process.env.NODE_ENV,
          },
        ]);

        const text = `
      New Order request
      ENV: ${process.env.NODE_ENV}
      Invoice Request: ${invoice.request}
      Invoice Tokens: ${invoice.tokens}
      Prompt: ${prompt}
      `;

        await telegramBot.sendMessageToAdmins(text);
        if (error) return res.status(500).send({ error: error.message });
        console.log("Invoice generated: ", invoice);
        res.status(200).send(invoice);
      } catch (e) {
        console.log(e);
        res.status(500).send({ error: e.message });
      }
    }
  );

  app.get("/dalle2-test", async (req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(500).send({ error: "Not allowed" });
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
      res.status(200).send({ images });
    } catch (e) {
      if (e.error) {
        res.status(400).send({ error: e.error });
      }
      res.status(400).send({ error: e });
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

      return res.status(200).send({
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

      if (error) return res.status(500).send({ error: error.message });

      return res.status(200).send({
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
          .status(500)
          .send({ status: state.SERVER_ERROR, message: error.message });
      }

      await telegramBot.sendMessageToAdmins(
        "Refund request recieved for " + invoiceId
      );

      await telegramBot.sendMessageToAdmins(refundInvoice);

      return res.status(200).send({
        status: state.REFUND_RECIEVED,
        message: MESSAGE.REFUND_RECIEVED,
      });
    }
  );

  app.post(
    "/generate",
    async (
      req: Request<
        unknown,
        unknown,
        { prompt: string; invoiceId: string },
        unknown
      >,
      res
    ) => {
      // Check if params passed
      if (!req.body.prompt || !req.body.invoiceId) {
        res
          .status(400)
          .send({ status: state.USER_ERROR, message: "Missing parameters" });
        return;
      }
      try {
        // get invoice from lnd
        const { prompt, invoiceId: id } = req.body;
        const invoice = await lnService.getInvoice({
          lnd,
          id,
        });

        if (!invoice)
          return res.status(400).send({
            status: state.INVOICE_NOT_FOUND,
            message: MESSAGE.INVOICE_NOT_FOUND,
          });

        // Get order object from database
        const { data: order, error } = await supabase
          .from<Order>("Orders")
          .select("*")
          .match({ invoice_id: invoice.id })
          .limit(1)
          .single();

        if (order.results) {
          return res.status(200).send({
            status: state.DALLE_GENERATED,
            message: MESSAGE.DALLE_GENERATED,
            images: order.results,
          });
        }

        if (invoice.is_confirmed && !order.generated) {
          // Update order to indicate that images are being generated
          const { data: updateOrder, error } = await supabase
            .from<Order>("Orders")
            .update({ generated: true })
            .match({ invoice_id: invoice.id })
            .single();

          if (error) {
            console.error(error);
            return res.status(500).send({
              status: state.SERVER_ERROR,
              message: MESSAGE.SERVER_ERROR,
            });
          }

          if (process.env.MOCK_IMAGES === "true") {
            return res.status(200).send({
              status: state.DALLE_GENERATED,
              message: MESSAGE.DALLE_GENERATED,
              images: [
                "https://cdn.openai.com/labs/images/3D%20render%20of%20a%20cute%20tropical%20fish%20in%20an%20aquarium%20on%20a%20dark%20blue%20background,%20digital%20art.webp?v=1",
                "https://cdn.openai.com/labs/images/An%20armchair%20in%20the%20shape%20of%20an%20avocado.webp?v=1",
                "https://cdn.openai.com/labs/images/An%20expressive%20oil%20painting%20of%20a%20basketball%20player%20dunking,%20depicted%20as%20an%20explosion%20of%20a%20nebula.webp?v=1",
                "https://cdn.openai.com/labs/images/A%20photo%20of%20a%20white%20fur%20monster%20standing%20in%20a%20purple%20room.webp?v=1",
              ],
            });
          }
          // Generate images
          try {
            const dalleImages = await dalle2.generate(prompt);
            // Upload to S3
            const images: string[] = await Promise.all(
              dalleImages.map((image_url: string, index: number) =>
                uploadFileToS3(image_url, BUCKET_NAME, `${id}-${index}.png`)
              )
            );

            console.log(images);

            // Update order to indicate that images have been generated
            const { data: updatedOrder, error: error2 } = await supabase
              .from<Order>("Orders")
              .update({ results: images })
              .match({ invoice_id: invoice.id })
              .single();

            if (error2) {
              console.error(error);
              return res.status(500).send({
                status: state.SERVER_ERROR,
                message: error2.message,
              });
            }

            // Send telegram message to myself
            const text = `
          Received new order!
          Prompt: "${prompt}"
          Invoice ID: ${invoice.id}
          Satoshis: ${invoice.tokens}
          `;

            try {
              await telegramBot.sendImagesToAdmins(images, prompt);
              await telegramBot.sendImagesToGroup(images, prompt);
              await telegramBot.sendMessageToAdmins(text);
            } catch (e) {
              console.error("Posting to telegram failed");
              console.error(e);
            }
          } catch (e) {
            return res.status(400).send({
              status: state.SERVER_ERROR,
              message: "Error occured, please send refund",
            });
          }
        } else if (invoice.is_canceled) {
          return res.status(200).send({
            status: state.INVOICE_CANCELLED,
            message: MESSAGE.INVOICE_CANCELLED,
          });
        } else if (!invoice.is_confirmed) {
          console.log({
            status: state.INVOICE_NOT_PAID,
            message: MESSAGE.INVOICE_NOT_PAID,
            invoice: invoice.request,
          });
          return res.status(200).send({
            status: state.INVOICE_NOT_PAID,
            message: MESSAGE.INVOICE_NOT_PAID,
          });
        } else if (invoice.is_confirmed && order.generated) {
          console.log({
            status: state.DALLE_GENERATING,
            message: MESSAGE.DALLE_GENERATING,
          });
          return res.status(200).send({
            status: state.DALLE_GENERATING,
            message: MESSAGE.DALLE_GENERATING,
          });
        } else {
          console.log("SERVER ERROR 1");
          return res.status(200).send({
            status: state.SERVER_ERROR,
            message: MESSAGE.SERVER_ERROR,
          });
        }
      } catch (e) {
        console.error(e);
        console.log("SERVER ERROR 2");

        return res.status(500).send({
          status: state.SERVER_ERROR,
          message: e.message,
        });
      }
    }
  );

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });

  return app;
};