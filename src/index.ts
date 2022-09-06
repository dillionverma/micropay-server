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
import { Dalle, ImageData } from "./Dalle";

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
};

const { adminMacaroon: macaroon, tlsCert: cert, host } = config;
const socket = `${host}:10009`;
const { lnd } = lnService.authenticatedLndGrpc({
  macaroon,
  socket,
});

const dalle = new Dalle({ apiKey: config.dalleApiKey });

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
  // const img =
  //   "https://dalle2-lightning.s3.amazonaws.com/fec41299d7bda695a47efd4b9c28bef1a27d6576e12808b8220403c72b2d23db.png";
  // const rs = await uploadFileToS3(img, BUCKET_NAME, "test5.png");
  // console.log(rs);
  res.status(200).send("Hello World");
});

app.get("/invoice", async (req, res) => {
  try {
    const invoice = await lnService.createInvoice({
      lnd,
      description: "Dalle-2 Image generation request",
      tokens: 1000,
    });
    const { data, error } = await supabase.from("Orders").insert([
      {
        invoice_id: invoice.id,
        invoice_request: invoice.request,
        satoshis: invoice.tokens,
      },
    ]);

    const text = `
    New Order request
    Invoice ID: ${invoice.id}
    Invoice Request: ${invoice.request}
    Invoice Tokens: ${invoice.tokens}
    `;

    await personalTelegram.sendMessage(config.telegramUserId, text);
    if (error) return res.status(500).send({ error: error.message });
    console.log("Invoice generated: ", invoice);
    res.status(200).send(invoice);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

// const img =
// uploadFileToS3(<your_file_url>, <your_s3_path>, <your_s3_bucket>)
//    .then(() => console.log("File saved!"))
//    .catch(error) => console.log(error));

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
      res.status(400).send({ error: "Missing parameters" });
      return;
    }
    try {
      // get invoice from lnd
      const { prompt, invoiceId: id } = req.body;
      const invoice = await lnService.getInvoice({
        lnd,
        id,
      });

      if (!invoice) return res.status(400).send({ error: "Invoice not found" });

      // Get order object from database
      const { data: order, error } = await supabase
        .from<Order>("Orders")
        .select("*")
        .match({ invoice_id: invoice.id })
        .limit(1)
        .single();

      if (invoice.is_confirmed && !order.generated) {
        // Update order to indicate that images are being generated
        const { data: updateOrder, error } = await supabase
          .from<Order>("Orders")
          .update({ generated: true })
          .match({ invoice_id: invoice.id })
          .single();

        if (error) {
          console.error(error);
          return res.status(500).send({ error: error.message });
        }

        // Generate images
        const { data } = await dalle.generate(prompt);

        console.log("DATA: ", data);
        // const images = data.map((data) => data.generation.image_path);

        // Upload to S3
        const images: string[] = await Promise.all(
          data.map((image: ImageData, index: number) =>
            uploadFileToS3(
              image.generation.image_path,
              BUCKET_NAME,
              `${id}-${index}.png`
            )
          )
        );

        console.log(images);

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

          await groupTelegram.sendMediaGroup(
            config.telegramGroupId,
            images.map((img, i) => ({
              type: "photo",
              media: img,
              caption: i === 0 ? prompt : "",
            }))
          );

          await personalTelegram.sendMessage(config.telegramUserId, text);
        } catch (e) {
          console.error("Posting to telegram failed");
          console.error(e);
        }

        // Update order to indicate that images have been generated
        const { data: updatedOrder, error: error2 } = await supabase
          .from<Order>("Orders")
          .update({ results: images })
          .match({ invoice_id: invoice.id })
          .single();

        if (error2) {
          console.error(error);
          return res.status(500).send({ error: error2.message });
        }

        res.status(200).send(images);
      } else if (invoice.is_canceled) {
        res.status(400).send({ error: "Invoice cancelled" });
      } else {
        res.status(400).send({ error: "Invoice not paid yet" });
      }
    } catch (e) {
      console.error(e);
      res.status(500).send({ error: e.message });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
