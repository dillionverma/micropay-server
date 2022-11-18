import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";
import sinonChai from "sinon-chai";
import {
  stableDiffusionQueue,
  stableDiffusionWorker,
} from "./../../src/jobs/stableDiffusion.job";

chai.use(chaiAsPromised);
chai.use(chaiHttp);
chai.use(sinonChai);
const expect = chai.expect;

const prompt: string =
  "a matte painting of a girl with a backpack and a smartphone that traveled back in time to an ancient Greek colosseum with gladiators, showing her back";

describe.only("StableDiffusion Job", () => {
  before(async () => {
    await stableDiffusionQueue.obliterate();
  });

  describe("generate", async () => {
    after(() => {});

    it("should successfully generate images, upload to s3, and ping telegram", async () => {
      const job = await stableDiffusionQueue.add(
        "generate",
        {
          prompt,
        },
        {
          attempts: 5, // Something else is most likely wrong at this point
          backoff: {
            type: "fixed",
            delay: 1000,
          },
        }
      );

      await new Promise((resolve) =>
        stableDiffusionWorker.on("completed", resolve)
      );

      expect(await job.getState()).to.equal("completed");
    });
  });
});
