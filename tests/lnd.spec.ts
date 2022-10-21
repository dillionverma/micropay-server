import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import lnService from "lightning";
import { config } from "../src/config";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("lnService", () => {
  let lnd: lnService.AuthenticatedLnd;

  before(() => {
    const { lndMacaroonAdmin: macaroon, lndHost: host } = config;
    const socket = `${host}:10009`;

    // Create a new authenticated lnd gRPC connection
    const res = lnService.authenticatedLndGrpc({
      macaroon,
      socket,
    });
    lnd = res.lnd;
  });

  describe("getWalletInfo", () => {
    it("should get wallet info", async () => {
      try {
        const nodePublicKey = (await lnService.getWalletInfo({ lnd }))
          .public_key;

        expect(nodePublicKey).to.exist;
      } catch (error) {
        console.log(error);
      }
    });
  });

  describe("createInvoice", () => {
    it("should create an invoice", async () => {
      try {
        const invoice = await lnService.createInvoice({
          lnd,
          description: "test",
          tokens: 1000,
        });

        const id = invoice.id;

        // TODO: WIP
        // const sub = lnService.subscribeToInvoice({ id, lnd });
        // const [invoiceUpdate] = await once(sub, "invoice_updated");
        // await new Promise((r) => setTimeout(r, 10000));
        console.log(invoice);
      } catch (error) {
        console.log(error);
      }
    });
  });
});
