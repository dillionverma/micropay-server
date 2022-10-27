import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { config } from "../../src/config";
import Lightning from "../../src/services/lightning.service";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("lightning", () => {
  let lightning: Lightning;

  before(() => {
    // Create a new authenticated lnd gRPC connection
    lightning = new Lightning(
      config.lndMacaroonAdmin,
      config.lndHost,
      config.lndPort
    );
  });

  describe("getWalletInfo", () => {
    it("should get wallet info", async () => {
      const wallet = await lightning.getWalletInfo();

      expect(wallet).to.be.a("object");
      expect(wallet.active_channels_count).to.be.a("number");
      expect(wallet.active_channels_count).to.be.greaterThan(0);
      expect(wallet.is_synced_to_chain).to.be.a("boolean");
      expect(wallet.is_synced_to_chain).to.be.true;
    });
  });

  describe("createInvoice", () => {
    it("should create an invoice", async () => {
      const description = "test invoice";
      const amount = 1000;
      const invoice = await lightning.createInvoice(description, amount);

      expect(invoice).to.be.a("object");
      expect(invoice.id).to.be.a("string");
      expect(invoice.chain_address).to.be.a("undefined");
      expect(invoice.created_at).to.be.a("string");
      expect(invoice.description).to.be.a("string");
      expect(invoice.mtokens).to.be.a("string");
      expect(invoice.payment).to.be.a("string");
      expect(invoice.request).to.be.a("string");
      expect(invoice.secret).to.be.a("string");
      expect(invoice.tokens).to.be.a("number");

      expect(invoice.description).to.equal(description);
      expect(invoice.mtokens).to.equal((amount * 1000).toString());
      expect(invoice.tokens).to.equal(amount);
    });
  });
});
