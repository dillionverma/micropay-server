import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiFiles from "chai-files";
import { createRequire } from "module";
import { config } from "../../src/config";
import OpenAI from "../../src/services/openai.service";

import { getRandomElement } from "../../src/utils";
const require = createRequire(import.meta.url);

chai.use(chaiAsPromised);
chai.use(chaiFiles);
const expect = chai.expect;
var file = chaiFiles.file;

// Official prompt examples taken from Dalle-2 website
export const officialPrompts = [
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
  "synthwave sports car",
  "panda mad scientist mixing sparkling chemicals, digital art",
];

describe("OpenAI API", () => {
  let openai: OpenAI;

  before(() => {
    openai = new OpenAI(config.openaiApiKey);
  });

  describe.skip("Generate 1 image using openai API", () => {
    it("should generate images", async () => {
      let prompt: string = getRandomElement(officialPrompts);
      try {
        const images = await openai.createImage(prompt, 1);
        console.log(images);
      } catch (error) {
        console.log(error);
      }
    });
  });
});
