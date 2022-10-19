import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";

chai.use(chaiAsPromised);
chai.use(chaiHttp);
const expect = chai.expect;

describe("Dalle2 Job", () => {
  describe("generate", () => {
    it("should successfully generate images, upload to s3, and update database", async () => {
      // TODO: implement
    });
  });
});
