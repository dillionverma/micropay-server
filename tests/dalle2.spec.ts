import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiFiles from "chai-files";
import fs from "fs";
import { createRequire } from "module";
import { config } from "../src/config";
import { Dalle2, Task } from "../src/Dalle2";
const require = createRequire(import.meta.url);

chai.use(chaiAsPromised);
chai.use(chaiFiles);
const expect = chai.expect;
var file = chaiFiles.file;

const prompts = [
  "a matte painting of a girl with a backpack and a smartphone that traveled back in time to an ancient Greek colosseum with gladiators, showing her back",
  "Toronto streetcar on a rainy night in a techno style",
  "italian man with a mustache dressed as mario wearing a solid red mario hat, crawling on the ground, licking a red mushroom with white spots, in a forest, photography, 50mm lens, f1.8",
];

describe("Dalle-2 API", () => {
  let dalle2: Dalle2;
  let task: Task;

  before(() => {
    dalle2 = new Dalle2(config.dalleApiKey);
    task = require("./fixtures/task.json");
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
      // SELECT A PROMPT
      let prompt: string = prompts[0];

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
});
