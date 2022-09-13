import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";
import { createClient } from "@supabase/supabase-js";
import aws from "aws-sdk";
import axios from "axios";
import cors from "cors";
import express, { Request } from "express";
import lnService from "lightning";
import { Telegram } from "telegraf";
import config from "./config";
import { Dalle } from "./Dalle";
import { Dalle2 } from "./Dalle2";

aws.config.credentials = new aws.Credentials(
  config.awsAccessKey,
  config.awsSecretKey
);
const s3 = new aws.S3();

const personalTelegram: Telegram = new Telegram(config.personalTelegramToken);
const groupTelegram: Telegram = new Telegram(config.groupTelegramToken);
const supabase = createClient(config.supabaseUrl, config.supabaseApiKey);

type Order = {
  id: number;
  created_at: Date;
  invoice_id: string;
  invoice_request: string;
  generated: boolean;
  satoshis: number;
  results: string[];
  prompt: string;
  environment: string;
  refundInvoice: string;
  rating: number;
  feedback: string;
};

const { adminMacaroon: macaroon, tlsCert: cert, host } = config;
const socket = `${host}:10009`;
const { lnd } = lnService.authenticatedLndGrpc({
  macaroon,
  socket,
});

const dalle = new Dalle({ apiKey: config.dalleApiKey });
const dalle2 = new Dalle2(config.dalleApiKey);

const PORT = 3001;
const app = express();

Sentry.init({
  dsn: config.sentryDsn,
  integrations: [
    // enable HTTP calls tracing
    new Sentry.Integrations.Http({ tracing: true }),
    // enable Express.js middleware tracing
    new Tracing.Integrations.Express({ app }),
  ],

  environment: process.env.NODE_ENV,
  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

// RequestHandler creates a separate execution context using domains, so that every
// transaction/span/breadcrumb is attached to its own Hub instance
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

app.use(cors());
app.use(express.urlencoded({ extended: true })); // parse application/x-www-form-urlencoded
app.use(express.json()); // parse application/json

const BUCKET_NAME = "dalle2-lightning";

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

const uploadFileToS3 = async (
  url: string,
  bucket: string = BUCKET_NAME,
  key: string
): Promise<string> => {
  return axios
    .get(url, { responseType: "arraybuffer", responseEncoding: "binary" })
    .then(async (response) => {
      const params = {
        ContentType: "image/png",
        ContentLength: response.data.length.toString(), // or response.header["content-length"] if available for the type of file downloaded
        Bucket: bucket,
        Body: response.data,
        Key: key,
      };
      await s3.putObject(params).promise();
      return `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`;
    })
    .catch((e) => {
      console.log(e);
      console.log("error");
      return "";
    });
};

app.get("/", async (req, res) => {
  res.status(200).send("Hello World");
});

const DEFAULT_PRICE = process.env.NODE_ENV === "production" ? 1000 : 50;

app.post(
  "/invoice",
  async (req: Request<unknown, unknown, { prompt: string }, unknown>, res) => {
    const { prompt } = req.body;

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

      await personalTelegram.sendMessage(config.telegramUserId, text);
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
    const { data: updatedOrder, error: error2 } = await supabase
      .from<Order>("Orders")
      .update({ rating, feedback })
      .match({ invoice_id: invoiceId })
      .single();

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
    // Update order to indicate that images have been generated
    const { data: updatedOrder, error: error2 } = await supabase
      .from<Order>("Orders")
      .update({ refundInvoice })
      .match({ invoice_id: invoiceId })
      .single();

    if (error2) {
      console.log("Error updating order: ", error2);
      return res
        .status(500)
        .send({ status: state.SERVER_ERROR, message: error2.message });
    }

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
            await personalTelegram.sendMediaGroup(
              config.telegramUserId,
              images.map((img) => ({
                type: "photo",
                media: img,
                caption: prompt,
              }))
            );

            // Only send to group telegram if not in dev
            if (process.env.NODE_ENV === "production") {
              await groupTelegram.sendMediaGroup(
                config.telegramGroupId,
                images.map((img, i) => ({
                  type: "photo",
                  media: img,
                  caption: i === 0 ? prompt : "",
                }))
              );
            }

            await personalTelegram.sendMessage(config.telegramUserId, text);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
