import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Index", () => {
  it("2 + 2 should return 4", () => {
    expect(2 + 2).to.eq(4);
  });
});
