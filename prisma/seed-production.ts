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
