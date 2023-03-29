import { run } from "@banana-dev/banana-dev";
import axios from "axios";
import { Job, Queue, Worker } from "bullmq";
import { config } from "../config";
import { prisma } from "../db/prisma.service";
import { aws, openai, pricing } from "../server";
import { ImageSize } from "../services/openai.service";
import { connection } from "../services/redis.service";

export enum Model {
  OPEN_JOURNEY = "0fad7b48-bb13-438f-a034-75c4b024722f",
}

export interface TaskParams {
  prompt: string;
  negative_prompt: string;
  height: number;
  width: number;
  guidance_scale: number;
  num_inference_steps: number;
  num_images: number;
  file_type: string;

  modelId: string;
  userId: string;
}

// https://docs.banana.dev/banana-docs/core-concepts/sdks/rest-api
export interface BananaResponse {
  id: string;
  message: string;
  created: number;
  apiVersion: string;
  callID: string;
  finished: boolean;
  modelOutputs: any[];
}

// REQUEST FORMAT TO BANANA.DEV
//   {
//     "apiKey":"b2246ac9-ac3a-417c-b074-b8aab240c5f6",
//     "modelKey":"0fad7b48-bb13-438f-a034-75c4b024722f",
//     "modelInputs":{
//        "prompt":"photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
//        "negative_prompt":"",
//        "height":512,
//        "width:":512,
//        "guidance_scale":7.5,
//        "num_inference_steps":5,
//        "num_images":4,
//        "file_type":"webp"
//     }
//  }

export const generateQueue = new Queue<TaskParams>(config.generateQueueName, {
  connection,
});

// job.id === task.id
export const generateWorker = new Worker<TaskParams>(
  config.generateQueueName,
  async (job: Job<TaskParams>) => {
    console.log("Starting job", job.id);
    const { modelId, userId, ...modelInputs } = job.data;
    console.log(job.data);

    const model = await prisma.model.findUnique({
      where: {
        id: modelId,
      },
    });

    if (model.name === "DALL·E 2") {
      // https://platform.openai.com/docs/guides/images/usage

      if (modelInputs.num_images < 1 || modelInputs.num_images > 10) {
        throw new Error("num_images must be between 1 and 10");
      }

      if (
        modelInputs.width !== 256 &&
        modelInputs.width !== 512 &&
        modelInputs.height !== 1024
      ) {
        throw new Error(
          "width and height must be 256x256, 512x512, or 1024x1024"
        );
      }

      if (
        modelInputs.width !== 256 &&
        modelInputs.width !== 512 &&
        modelInputs.height !== 1024
      ) {
        throw new Error(
          "width and height must be 256x256, 512x512, or 1024x1024"
        );
      }

      if (modelInputs.width !== modelInputs.height) {
        throw new Error(
          "width and height must be 256x256, 512x512, or 1024x1024"
        );
      }

      const dalleImages = await openai.createImage(
        modelInputs.prompt,
        modelInputs.num_images,
        `${modelInputs.width}x${modelInputs.height}` as ImageSize
      );

      console.log("dalle images", dalleImages);

      // subtract price from user balance
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      console.log("a");

      const price = await pricing.getPrice(modelId, job.data);

      console.log("b", price);

      if (user.sats < price) {
        throw new Error("Insufficient funds");
      }

      console.log("c");

      const updatedUser = await prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          sats: {
            decrement: price,
          },
        },
      });

      console.log("d");

      // Get image buffers
      const imageBuffers: Buffer[] = await Promise.all(
        dalleImages.map(async (url) => {
          const response = await axios(url, {
            method: "GET",
            responseType: "arraybuffer",
          });
          return response.data;
        })
      );

      // Populate image records
      await Promise.all(
        imageBuffers.map(async (buf: Buffer) => {
          const image = await prisma.image.create({
            data: {
              width: modelInputs.width,
              height: modelInputs.height,
              user: {
                connect: {
                  id: userId,
                },
              },
              task: {
                connect: {
                  id: job.id,
                },
              },
              model: {
                connect: {
                  id: modelId,
                },
              },
            },
          });

          const url = await aws.uploadImageBufferToS3(
            "micropay",
            buf,
            image.id,
            "webp"
          );

          const updated = await prisma.image.update({
            where: {
              id: image.id,
            },
            data: {
              url: url,
            },
          });

          console.log(updated);
        })
      );
    } else {
      const model_key = model.modelKey;

      try {
        console.log("test", model_key);
        console.log(config.bananaApiKey);

        const res = (await run(
          config.bananaApiKey,
          model_key,
          modelInputs
        )) as BananaResponse;

        console.log("res", res);

        const images = res.modelOutputs[0].images_base64;

        // Populate image records
        await Promise.all(
          images.map(async (b64: string) => {
            const image = await prisma.image.create({
              data: {
                width: modelInputs.width,
                height: modelInputs.height,
                user: {
                  connect: {
                    id: userId,
                  },
                },
                task: {
                  connect: {
                    id: job.id,
                  },
                },
                model: {
                  connect: {
                    id: modelId,
                  },
                },
              },
            });

            const url = await aws.uploadImageBufferToS3(
              "micropay",
              Buffer.from(b64, "base64"),
              image.id,
              "webp"
            );

            const updated = await prisma.image.update({
              where: {
                id: image.id,
              },
              data: {
                url: url,
              },
            });

            console.log(updated);
          })
        );

        // const imageRecords = await prisma.image.createMany({
        //   data: images.map(() => ({
        //     taskId: job.id,
        //     width: modelInputs.width,
        //     height: modelInputs.height,
        //   })),
        // });

        // console.log(imageRecords);

        // Upload to CDN
        // await Promise.all(
        //   images.map(
        //     async (b64: string) =>
        //       await aws.uploadImageBufferToS3(
        //         Buffer.from(b64, "base64"),
        //         "key",
        //         "micropay"
        //       )
        //   )
        // );

        // console.log(res.modelOutputs[0]);

        // console.log(out);
        // const urls = await stability.generate(prompt);
        // console.log(urls);

        // if (process.env.NODE_ENV !== "test") {
        //   const { data, error } = await supabase
        //     .from<Order>("Orders")
        //     .update({ results: urls })
        //     .match({ uuid: job.id })
        //     .single();

        //   if (error) {
        //     console.error(error);
        //     throw error;
        //   }

        //   // Send telegram message
        //   const text = `
        //   🖌️ Received new free generation:
        //   Prompt: "${prompt}"
        //   `;

        //   try {
        //     await telegramBot.sendImagesToGroup(urls, prompt);
        //     await telegramBot.sendMessageToAdmins(text);
        //   } catch (e) {
        //     console.error("Posting to telegram failed");
        //     console.error(e);
        //   }
        // }

        return "ok";
      } catch (e) {
        console.log(e);
        throw new Error(e);
      }
    }
  },
  {
    connection,
    concurrency: 50,
  }
);
