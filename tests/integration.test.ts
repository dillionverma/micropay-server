import { Model, Task, User } from "@prisma/client";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";
import { createRequire } from "module";
import { aws } from "../src/server";
import { prisma } from "./../src/db/prisma.service";
const require = createRequire(import.meta.url);

chai.use(chaiAsPromised);
chai.use(chaiHttp);
const expect = chai.expect;

describe.skip("db", () => {
  describe("image upload test", () => {
    it("should upload image and log url", async () => {
      let task = require("./fixtures/taskResponse.json");

      let image = Buffer.from(task.modelOutputs[0].images_base64[0], "base64");

      const url = await aws.uploadImageBufferToS3(
        "micropay",
        image,
        "test2",
        "webp"
      );

      console.log(url);
    });
  });

  describe("Test all models and interactions", () => {
    let model: Model;
    let alice: User;
    let bob: User;
    let task: Task;

    it("should create OpenJourney model", async () => {
      model = await prisma.model.create({
        data: {
          name: "openjourney",
          author: "prompthero",
          authorUrl: "https://huggingface.co/prompthero/openjourney",
          description:
            "Openjourney is an open source Stable Diffusion fine tuned model on Midjourney images",
          modelKey: "0fad7b48-bb13-438f-a034-75c4b024722f",
          unitPriceUSD: 0.05,
        },
      });

      console.log(model);
    });

    it("should create user 1", async () => {
      alice = await prisma.user.create({
        data: {
          name: "alice",
          email: "hello@alice.com",
          username: "alice",
        },
      });

      console.log(alice);
    });

    it("should create user 2", async () => {
      bob = await prisma.user.create({
        data: {
          name: "bob",
          email: "hello@bob.com",
          username: "bob",
        },
      });

      console.log(bob);
    });

    it("should let user 1 follow user 2", async () => {
      const follow = await prisma.follows.create({
        data: {
          followerId: alice.id,
          followingId: bob.id,
        },
      });

      console.log(follow);
    });

    it("should let user 2 follow user 1", async () => {
      const follow = await prisma.follows.create({
        data: {
          followerId: bob.id,
          followingId: alice.id,
        },
      });

      console.log(follow);
    });

    it("should let user 1 create a task", async () => {
      const task = await prisma.task.create({
        data: {
          user: {
            connect: {
              id: alice.id,
            },
          },
          model: {
            connect: {
              id: model.id,
            },
          },
          params: {
            prompt:
              "photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
            negative_prompt: "",
            height: 512,
            width: 512,
            guidance_scale: 7.5,
            num_inference_steps: 5,
            num_images: 4,
            file_type: "webp",
          },
        },
      });

      console.log(task);
    });
  });
});
