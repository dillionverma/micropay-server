import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";
import sinonChai from "sinon-chai";
import { findLsatByToken } from "../../src/db/lsats";

chai.use(chaiAsPromised);
chai.use(chaiHttp);
chai.use(sinonChai);
const expect = chai.expect;

describe("findLsatByToken", () => {
  it("should return null if no LSAT is found", async () => {
    const token = "test-token";
    const result = await findLsatByToken(token);
    expect(result).to.be.null;
  });
});
