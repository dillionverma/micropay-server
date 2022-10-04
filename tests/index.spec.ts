import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("Index", () => {
  it("2 + 2 should return 4", () => {
    expect(2 + 2).to.eq(4);
  });
});

// describe("do request to lnd node", () => {
//   it("should do request", async () => {
//     const { adminMacaroon: macaroon, tlsCert: cert, host } = config;

//     const socket = `${host}:10009`;

//     const { lnd } = lnService.authenticatedLndGrpc({
//       macaroon,
//       socket,
//     });

//     try {
//       const nodePublicKey = (await lnService.getWalletInfo({ lnd })).public_key;

//       console.log(nodePublicKey);
//     } catch (error) {
//       console.log(error);
//     }

//     try {
//       const invoice = await lnService.createInvoice({
//         lnd,
//         description: "test",
//         tokens: 1000,
//       });

//       const id = invoice.id;

//       const sub = lnService.subscribeToInvoice({ id, lnd });

//       const [invoiceUpdate] = await once(sub, "invoice_updated");

//       // await new Promise((r) => setTimeout(r, 10000));

//       console.log(invoice);
//     } catch (error) {
//       console.log(error);
//     }
//   });
// });

// const prompts = [
//   "a matte painting of a girl with a backpack and a smartphone that traveled back in time to an ancient Greek colosseum with gladiators, showing her back",
//   "Toronto streetcar on a rainy night in a techno style",
// ];

describe("generate images", () => {
  it("should generate images", async () => {
    // const dalle = new Dalle({ apiKey: config.dalleApiKey });
    // // Call the Dall-e 2 API
    // const response = await dalle.generate(
    //   "a matte painting of a girl with a backpack and a smartphone that traveled back in time to an ancient Greek colosseum with gladiators, showing her back"
    // );
    // console.log(response);
    // // Get the image array from the response object
    // const { data } = response;
    // // Return the image array
    // return data;
  });
});
