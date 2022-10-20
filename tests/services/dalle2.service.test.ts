import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiFiles from "chai-files";
import fs from "fs";
import { createRequire } from "module";
import { config } from "../../src/config";
import Dalle2, { Task } from "../../src/services/dalle2.service";
import { getNRandomElements, getRandomElement, sleep } from "../../src/utils";
const require = createRequire(import.meta.url);

chai.use(chaiAsPromised);
chai.use(chaiFiles);
const expect = chai.expect;
var file = chaiFiles.file;

// Official prompt examples taken from Dalle-2 website
const officialPrompts = [
  "a macro 35mm photograph of two mice in Hawaii, they're each wearing tiny swimsuits and are carrying tiny surf boards, digital art",
  "3D render of a cute tropical fish in an aquarium on a dark blue background, digital art",
  "an astronaut playing basketball with cats in space, digital art",
  "an astronaut lounging in a tropical resort in space, pixel art",
  "an oil pastel drawing of an annoyed cat in a spaceship",
  "a sunlit indoor lounge area with a pool with clear water and another pool with translucent pastel pink water, next to a big window, digital art",
  '"a sea otter with a pearl earring" by Johannes Vermeer',
  "photograph of an astronaut riding a horse",
  "crayon drawing of several cute colorful monsters with ice cream cone bodies on dark blue paper",
  "a pencil and watercolor drawing of a bright city in the future with flying cars",
  "a stained glass window depicting a robot",
  "teddy bears shopping for groceries, one-line drawing",
  "a painting of a fox in the style of Starry Night",
  "a bowl of soup that looks like a monster, knitted out of wool",
  "a fortune-telling shiba inu reading your fate in a giant hamburger, digital art",
  "an expressive oil painting of a basketball player dunking, depicted as an explosion of a nebula",
  "a stern-looking owl dressed as a librarian, digital art",
  "an oil painting by Matisse of a humanoid robot playing chess",
  "a bowl of soup that is also a portal to another dimension, digital art",
];

describe("Dalle-2 API", () => {
  let dalle2: Dalle2;
  let task: Task;

  before(() => {
    dalle2 = new Dalle2(config.dalleApiKey);
    task = require("../fixtures/task.json");
  });

  describe("isTokenValid", () => {
    it("should return true if token is valid", async () => {
      const valid = await dalle2.isTokenValid();
      expect(valid).to.be.true;
    });

    it("should return false if token is invalid", async () => {
      const dalle2Invalid = new Dalle2("blah blah blah");
      const valid = await dalle2Invalid.isTokenValid();
      expect(valid).to.be.false;
    });
  });

  describe("getCredits", () => {
    it("should get the credits", async () => {
      const credits = await dalle2.getCredits();
      expect(credits).to.exist;
      expect(credits.aggregate_credits).to.be.a("number");
      expect(credits.object).to.equal("credit_summary");
    });
  });

  // Skip by default since it costs money.
  // Uncomment to run locally
  describe.skip("generate", () => {
    it("should generate images", async () => {
      let prompt: string = getRandomElement(officialPrompts);

      try {
        const images = await dalle2.generate(prompt);
        console.log(images);
      } catch (error) {
        console.log(error);
      }
    });

    it("should not generate image if it contains profanity", async () => {
      let prompt: string = "test swearword: fuck giraffe (please don't ban)";
      try {
        const images = await dalle2.generate(prompt);
        console.log(images);
      } catch (error) {
        console.log(error);
      }
    });
  });

  describe("publish", () => {
    it("should publish the image", async () => {
      const generationId = task.generations.data[0].id;
      const imageData = await dalle2.publish(generationId);
      const id = generationId.split("generation-")[1];
      expect(imageData).to.equal(`https://labs.openai.com/s/${id}`);
    });
  });

  describe("download", () => {
    it("should download the image", async () => {
      const generationId = task.generations.data[0].id;
      const image = await dalle2.download(generationId);
      expect(image).to.exist;
      expect(image).to.be.an.instanceOf(Buffer);
    });
  });

  describe("downloadFile", () => {
    it("should download the image as a file", async () => {
      const filename = "test.png";
      const generationId = task.generations.data[0].id;
      await dalle2.downloadFile(generationId, filename);
      expect(file("test.png")).to.exist;
      fs.unlinkSync(filename); // delete the file
    });
  });

  describe("investigate rate limit for task creation", async () => {
    // Skip by default since it costs money.
    it.skip("should create 5 tasks at the same time to see if they succeed", async () => {
      const numTasks = 5;
      const prompts = getNRandomElements(officialPrompts, numTasks);

      console.time("Generating 5 tasks at the same time");
      try {
        const all_images = await Promise.all(
          prompts.map((prompt) => dalle2.generate(prompt))
        );

        console.log(all_images);
      } catch (error) {
        console.log(error);
      }
      console.timeEnd("Generating 5 tasks at the same time");
    });

    // Skip by default since it costs money.
    it.skip("should create 30 tasks at the same time to see if they succeed", async () => {
      const numTasks = 30;
      const prompts: string[] = getNRandomElements(officialPrompts, numTasks);

      console.time("Generating 30 tasks at the same time");
      try {
        const all_images = await Promise.all(
          prompts.map((prompt) => dalle2.generate(prompt))
        );

        console.log(all_images);
      } catch (error) {
        console.log(error);
      }
      console.timeEnd("Generating 30 tasks at the same time");
    });

    // Skip by default since it costs money.
    it.skip(
      "should create 1 task every 5 seconds for 1 minute (12 tasks total)",
      async () => {
        const stepTime = 5000; // 5 seconds
        const totalTime = 60000; // 1 minute

        console.time(
          "Generating 1 task every 5 seconds for 1 minute (12 tasks total)"
        );

        let interval;
        try {
          interval = setInterval(async () => {
            console.log(new Date().toLocaleTimeString(), " Creating task...");
            const prompt = getRandomElement(officialPrompts);
            const images = await dalle2.generate(prompt);
            console.log(images);
          }, stepTime);

          await sleep(totalTime + stepTime); // the first setInterval starts after `time` milliseconds
        } catch (error) {
          console.log(error);
        } finally {
          clearInterval(interval);
        }
        console.timeEnd(
          "Generating 1 task every 5 seconds for 1 minute (12 tasks total)"
        );
      }
    ).timeout(120000); // 2 minutes timeout for this testcase specifically
  });
});
