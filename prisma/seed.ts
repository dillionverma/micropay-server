import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const model = await prisma.model.create({
    data: {
      name: "DALL·E 2",
      author: "OpenAI",
      authorUrl: "https://openai.com/dall-e-2/",
      description:
        "DALL·E 2 can create original, realistic images and art from a text description. It can combine concepts, attributes, and styles.",
      active: true,
      unitPriceUSD: 0.05,
    },
  });

  const model_openjourney = await prisma.model.create({
    data: {
      name: "Openjourney",
      author: "prompthero",
      authorUrl: "https://huggingface.co/prompthero/openjourney",
      description:
        "Openjourney is an open source Stable Diffusion fine tuned model on Midjourney images",
      modelKey: "0fad7b48-bb13-438f-a034-75c4b024722f",
      active: false,
      unitPriceUSD: 0.05,
    },
  });

  const model_sd15 = await prisma.model.create({
    data: {
      name: "Stable Diffusion 1.5",
      author: "runwayml",
      authorUrl: "https://huggingface.co/runwayml/stable-diffusion-v1-5",
      description:
        "Stable Diffusion is a High-Resolution Image Synthesis with Latent Diffusion Model",
      modelKey: "79a69d1a-9973-4973-bd7f-768f2c1520f4",
      active: false,
      unitPriceUSD: 0.05,
    },
  });

  const model_sd2 = await prisma.model.create({
    data: {
      name: "Stable Diffusion 2.1",
      author: "stabilityai",
      authorUrl: "https://huggingface.co/stabilityai/stable-diffusion-2-1",
      description:
        "Stable Diffusion is a High-Resolution Image Synthesis with Latent Diffusion Model",
      modelKey: "dfdb9372-7789-4dfe-b1f9-2033fc453a3b",
      active: false,
      unitPriceUSD: 0.05,
    },
  });

  const alice = await prisma.user.create({
    data: {
      email: "alice@prisma.io",
      name: "Alice",
      username: "alice",
      image:
        "https://secure.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50",
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: "bob@prisma.io",
      name: "Bob",
      username: "bob",
      image:
        "https://secure.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50",
    },
  });

  const charles = await prisma.user.create({
    data: {
      email: "charles@prisma.io",
      name: "Charles",
      username: "charles",
      image:
        "https://secure.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50",
    },
  });

  const daniel = await prisma.user.create({
    data: {
      email: "daniel@prisma.io",
      name: "Daniel",
      username: "daniel",
      image:
        "https://secure.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50",
    },
  });

  const edward = await prisma.user.create({
    data: {
      email: "edward@prisma.io",
      name: "Edward",
      username: "edward",
      image:
        "https://secure.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50",
    },
  });

  const aliceTask = await prisma.task.create({
    data: {
      userId: alice.id,
      modelId: model.id,
      params: {
        width: "512",
        height: "512",
        prompt:
          "mdjrny-v4 style, photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
        negative_prompt: "Disfigured, cartoon, blurry",
        num_images: 1,
        guidance_scale: 9,
        num_inference_steps: 50,
        seed: "1824818280",
      },
      images: {
        createMany: {
          data: [
            {
              modelId: model.id,
              userId: alice.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1588436706487-9d55d73a39e3",
            },
            {
              modelId: model.id,
              userId: alice.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1574180045827-681f8a1a9622",
            },
            {
              modelId: model.id,
              userId: alice.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1481277542470-605612bd2d61",
            },
            {
              modelId: model.id,
              userId: alice.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7",
            },
          ],
        },
      },
    },
  });

  const bobTask = await prisma.task.create({
    data: {
      userId: bob.id,
      modelId: model.id,
      params: {
        width: "512",
        height: "512",
        prompt:
          "mdjrny-v4 style, photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
        negative_prompt: "Disfigured, cartoon, blurry",
        num_images: 1,
        guidance_scale: 9,
        num_inference_steps: 50,
        seed: "1824818280",
      },
      images: {
        createMany: {
          data: [
            {
              modelId: model.id,
              userId: bob.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1588436706487-9d55d73a39e3",
            },
            {
              modelId: model.id,
              userId: bob.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1574180045827-681f8a1a9622",
            },
            {
              modelId: model.id,
              userId: bob.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1481277542470-605612bd2d61",
            },
            {
              modelId: model.id,
              userId: bob.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7",
            },
          ],
        },
      },
    },
  });

  const charlesTask = await prisma.task.create({
    data: {
      userId: charles.id,
      modelId: model.id,
      params: {
        width: "512",
        height: "512",
        prompt:
          "mdjrny-v4 style, photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
        negative_prompt: "Disfigured, cartoon, blurry",
        num_images: 1,
        guidance_scale: 9,
        num_inference_steps: 50,
        seed: "1824818280",
      },
      images: {
        createMany: {
          data: [
            {
              modelId: model.id,
              userId: charles.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1588436706487-9d55d73a39e3",
            },
            {
              modelId: model.id,
              userId: charles.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1574180045827-681f8a1a9622",
            },
            {
              modelId: model.id,
              userId: charles.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1481277542470-605612bd2d61",
            },
            {
              modelId: model.id,
              userId: charles.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7",
            },
          ],
        },
      },
    },
  });

  const danielTask = await prisma.task.create({
    data: {
      userId: daniel.id,
      modelId: model.id,
      params: {
        width: "512",
        height: "512",
        prompt:
          "mdjrny-v4 style, photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
        negative_prompt: "Disfigured, cartoon, blurry",
        num_images: 1,
        guidance_scale: 9,
        num_inference_steps: 50,
        seed: "1824818280",
      },
      images: {
        createMany: {
          data: [
            {
              modelId: model.id,
              userId: daniel.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1588436706487-9d55d73a39e3",
            },
            {
              modelId: model.id,
              userId: daniel.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1574180045827-681f8a1a9622",
            },
            {
              modelId: model.id,
              userId: daniel.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1481277542470-605612bd2d61",
            },
            {
              modelId: model.id,
              userId: daniel.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7",
            },
          ],
        },
      },
    },
  });

  const edwardTask = await prisma.task.create({
    data: {
      userId: edward.id,
      modelId: model.id,
      params: {
        width: "512",
        height: "512",
        prompt:
          "mdjrny-v4 style, photo of a gorgeous blonde female in the style of stefan kostic, realistic, half body shot, sharp focus, 8 k high definition, insanely detailed, intricate, elegant, art by stanley lau and artgerm, extreme blur cherry blossoms background",
        negative_prompt: "Disfigured, cartoon, blurry",
        num_images: 1,
        guidance_scale: 9,
        num_inference_steps: 50,
        seed: "1824818280",
      },
      images: {
        createMany: {
          data: [
            {
              modelId: model.id,
              userId: edward.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1588436706487-9d55d73a39e3",
            },
            {
              modelId: model.id,
              userId: edward.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1574180045827-681f8a1a9622",
            },
            {
              modelId: model.id,
              userId: edward.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1481277542470-605612bd2d61",
            },
            {
              modelId: model.id,
              userId: edward.id,
              width: 512,
              height: 512,
              url: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7",
            },
          ],
        },
      },
    },
  });

  console.log({ alice, bob, charles, daniel, edward });
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

const itemData = [
  {
    img: "https://images.unsplash.com/photo-1549388604-817d15aa0110",
    title: "Bed",
  },
  {
    img: "https://images.unsplash.com/photo-1525097487452-6278ff080c31",
    title: "Books",
  },
  {
    img: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6",
    title: "Sink",
  },
  {
    img: "https://images.unsplash.com/photo-1563298723-dcfebaa392e3",
    title: "Kitchen",
  },
  {
    img: "https://images.unsplash.com/photo-1588436706487-9d55d73a39e3",
    title: "Blinds",
  },
  {
    img: "https://images.unsplash.com/photo-1574180045827-681f8a1a9622",
    title: "Chairs",
  },
  {
    img: "https://images.unsplash.com/photo-1530731141654-5993c3016c77",
    title: "Laptop",
  },
  {
    img: "https://images.unsplash.com/photo-1481277542470-605612bd2d61",
    title: "Doors",
  },
  {
    img: "https://images.unsplash.com/photo-1517487881594-2787fef5ebf7",
    title: "Coffee",
  },
  {
    img: "https://images.unsplash.com/photo-1516455207990-7a41ce80f7ee",
    title: "Storage",
  },
  {
    img: "https://images.unsplash.com/photo-1597262975002-c5c3b14bbd62",
    title: "Candle",
  },
  {
    img: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4",
    title: "Coffee table",
  },
];
