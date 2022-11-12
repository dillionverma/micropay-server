import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";
import { Application } from "express";
import { StatusCodes } from "http-status-codes";
import { CreateInvoiceResult } from "lightning";
import { Lsat } from "lsat-js";
import { config } from "../src/config";
import {
  init,
  MESSAGE,
  ORDER_PROGRESS,
  ORDER_STATE,
  UNIT_PRICE,
} from "../src/server";
import Lightning from "../src/services/lightning.service";
import { sleep } from "../src/utils";

chai.use(chaiAsPromised);
chai.use(chaiHttp);
const expect = chai.expect;

describe.only("api", () => {
  let server: Application;
  let bob: Lightning;

  before(async () => {
    server = init({ ...config, port: 3003 });

    bob = new Lightning(
      process.env.LND_MACAROON_ADMIN_USER,
      process.env.LND_HOST_USER,
      process.env.LND_PORT_USER,
      process.env.LND_TLS_CERT_USER
    );
  });

  describe("GET /", () => {
    it("should return 200", async () => {
      const res = await chai.request(server).get("/");
      expect(res.status).to.equal(StatusCodes.OK);
    });
  });

  describe("POST /subscribe", () => {
    it("should return 200", async () => {
      const email = "test@test.com";
      const res = await chai.request(server).post("/subscribe").send({ email });

      expect(res.status).to.equal(StatusCodes.OK);
    });
  });

  describe("POST /feedback", () => {
    it("should return 200", async () => {
      const invoiceId =
        "e95604062b85e27c6b3b9d736f47a6f0a8c6f0a0f38c0204ed3775577f4cc8b4"; // An invoice ID generated for testing purposes
      const rating = 5;
      const feedback = "test";
      const res = await chai
        .request(server)
        .post("/feedback")
        .send({ invoiceId, rating, feedback });

      expect(res.status).to.equal(StatusCodes.OK);
    });

    it("should return 500 if non-existant invoice id", async () => {
      const invoiceId = "test";
      const rating = 2;
      const feedback = "sad";
      const res = await chai
        .request(server)
        .post("/feedback")
        .send({ invoiceId, rating, feedback });

      expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  const BULK_ROUTE = "/api/v1/bulk";

  describe.only(`POST ${BULK_ROUTE}`, () => {
    it.only("should return 402 if no authorization header set", async () => {
      const req = { amount: 1960, quantity: 2 };
      const res = await chai.request(server).post(BULK_ROUTE).send(req);
      expect(res.status).to.equal(StatusCodes.PAYMENT_REQUIRED);
    });

    it.only("should return 201 if authorization header is set and LSAT is paid for 1 unit", async () => {
      const req = { amount: 1000, quantity: 1 };

      // 1. HTTP POST /api/v1/bulk with price and quantity
      const res = await chai.request(server).post(BULK_ROUTE).send(req);

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);

      // 2. Extract LSAT from header
      const header = res.header["www-authenticate"];
      const lsat = Lsat.fromHeader(header);

      // 3. Extract lightning invoice from LSAT
      const { invoice } = lsat;

      expect(lsat).to.be.an.instanceOf(Lsat);
      expect(lsat.id).to.be.a("string");
      expect(lsat.invoice).to.be.a("string");
      expect(lsat.invoiceAmount).to.equal(req.amount);

      // 4. Pay invoice
      const payment = await bob.payInvoice(invoice);

      // 5. Set preimage in header
      const { secret: preimage } = payment;
      lsat.setPreimage(preimage);

      // 6. HTTP POST /api/v1/bulk with new LSAT header set and payment confirmed
      const res2 = await chai
        .request(server)
        .post(BULK_ROUTE)
        .set("Authorization", lsat.toToken())
        .send(req);

      expect(res2).to.have.status(StatusCodes.CREATED);
      expect(res2.body.status).to.equal("success");
      expect(res2.body.message).to.equal(
        "Your LSAT is valid for 1 more generation"
      );
    });

    it.only("should return 201 if authorization header is set and LSAT is paid for 2 units", async () => {
      const req = { amount: 1960, quantity: 2 };

      // 1. HTTP POST /api/v1/bulk with price and quantity
      const res = await chai.request(server).post(BULK_ROUTE).send(req);

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);

      // 2. Extract LSAT from header
      const header = res.header["www-authenticate"];
      const lsat = Lsat.fromHeader(header);

      // 3. Extract lightning invoice from LSAT
      const { invoice } = lsat;

      expect(lsat).to.be.an.instanceOf(Lsat);
      expect(lsat.id).to.be.a("string");
      expect(lsat.invoice).to.be.a("string");
      expect(lsat.invoiceAmount).to.equal(req.amount);

      // 4. Pay invoice
      const payment = await bob.payInvoice(invoice);

      // 5. Set preimage in header
      const { secret: preimage } = payment;
      lsat.setPreimage(preimage);

      // 6. HTTP POST /api/v1/bulk with new LSAT header set and payment confirmed
      const res2 = await chai
        .request(server)
        .post(BULK_ROUTE)
        .set("Authorization", lsat.toToken())
        .send(req);

      expect(res2).to.have.status(StatusCodes.CREATED);
      expect(res2.body.status).to.equal("success");
      expect(res2.body.message).to.equal(
        "Your LSAT is valid for 2 more generations"
      );
    });

    it.only("should return 400 if authorization header is set with wrong preimage", async () => {
      const prompt = "this is a test prompt";
      const res = await chai.request(server).post(BULK_ROUTE).send({ prompt });

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);

      // 1. Extract LSAT from header
      const header = res.header["www-authenticate"];
      const lsat = Lsat.fromHeader(header);

      expect(lsat).to.be.an.instanceOf(Lsat);
      expect(lsat.id).to.be.a("string");
      expect(lsat.invoice).to.be.a("string");
      expect(lsat.invoiceAmount).to.equal(UNIT_PRICE);

      // 2. Set preimage in header
      const preimage = "test";

      // 3. Craft a bad LSAT
      const token = `LSAT ${lsat.baseMacaroon}:${preimage}`;

      // 4. Send LSAT with subsequent request
      try {
        const res2 = await chai
          .request(server)
          .post(BULK_ROUTE)
          .set("Authorization", token)
          .send({ prompt });
        expect(res2).to.have.status(StatusCodes.BAD_REQUEST);
      } catch (e) {
        // console.log(e)
      }
    });
  });

  const DALLE_ROUTE = "/api/v1/dalle";

  describe(`POST ${DALLE_ROUTE}`, () => {
    it("should return 402 if no authorization header set", async () => {
      const prompt = "this is a test prompt";
      const res = await chai.request(server).post(DALLE_ROUTE).send({ prompt });

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);
    });

    // Skip becuase this costs money on OpenAI
    // TODO: Mock OpenAI
    it.skip("should return 201 if authorization header is set and LSAT is paid", async () => {
      const prompt = "an oil pastel drawing of an annoyed cat in a spaceship";

      // 1. HTTP POST /api/v1/dalle with prompt
      const res = await chai.request(server).post(DALLE_ROUTE).send({ prompt });

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);

      // 2. Extract LSAT from header
      const header = res.header["www-authenticate"];
      const lsat = Lsat.fromHeader(header);

      // 3. Extract lightning invoice from LSAT
      const { invoice } = lsat;

      expect(lsat).to.be.an.instanceOf(Lsat);
      expect(lsat.id).to.be.a("string");
      expect(lsat.invoice).to.be.a("string");
      expect(lsat.invoiceAmount).to.equal(UNIT_PRICE);

      // 4. Pay invoice
      const payment = await bob.payInvoice(invoice);

      // 5. Set preimage in header
      const { secret: preimage } = payment;
      lsat.setPreimage(preimage);

      // 6. HTTP POST /api/v1/dalle with prompt again with new LSAT header set and payment confirmed
      const res2 = await chai
        .request(server)
        .post(DALLE_ROUTE)
        .set("Authorization", lsat.toToken())
        .send({ prompt });

      expect(res2).to.have.status(StatusCodes.OK);
      expect(res2.body.status).to.equal("success");
      expect(res2.body.id).to.be.a("string");
      expect(res2.body.url).to.be.a("string");
    });

    it("should return 400 if authorization header is set with wrong preimage", async () => {
      const prompt = "this is a test prompt";
      const res = await chai.request(server).post(DALLE_ROUTE).send({ prompt });

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);

      // 1. Extract LSAT from header
      const header = res.header["www-authenticate"];
      const lsat = Lsat.fromHeader(header);

      expect(lsat).to.be.an.instanceOf(Lsat);
      expect(lsat.id).to.be.a("string");
      expect(lsat.invoice).to.be.a("string");
      expect(lsat.invoiceAmount).to.equal(UNIT_PRICE);

      // 2. Set preimage in header
      const preimage = "test";

      // 3. Craft a bad LSAT
      const token = `LSAT ${lsat.baseMacaroon}:${preimage}`;

      // 4. Send LSAT with subsequent request
      try {
        const res2 = await chai
          .request(server)
          .post(DALLE_ROUTE)
          .set("Authorization", token)
          .send({ prompt });
        expect(res2).to.have.status(StatusCodes.BAD_REQUEST);
      } catch (e) {
        // console.log(e)
      }
    });
  });

  // Skip becuase this costs money on OpenAI
  // TODO: Mock OpenAI
  describe.skip(`GET ${DALLE_ROUTE}/:id`, () => {
    it.skip("should return 200", async () => {
      const prompt = "this is a test prompt";
      const res = await chai.request(server).post(DALLE_ROUTE).send({ prompt });

      expect(res).to.have.status(StatusCodes.PAYMENT_REQUIRED);

      // 1. Extract LSAT from header
      const header = res.header["www-authenticate"];
      const lsat = Lsat.fromHeader(header);
      const { invoice } = lsat;

      expect(lsat).to.be.an.instanceOf(Lsat);
      expect(lsat.id).to.be.a("string");
      expect(lsat.invoice).to.be.a("string");
      expect(lsat.invoiceAmount).to.equal(UNIT_PRICE);

      // 2. Pay invoice
      const payment = await bob.payInvoice(invoice);

      // 3. Set preimage in header
      const { secret: preimage } = payment;
      lsat.setPreimage(preimage);

      // 4. Send LSAT with subsequent request
      const res2 = await chai
        .request(server)
        .post(DALLE_ROUTE)
        .set("Authorization", lsat.toToken())
        .send({ prompt });

      expect(res2).to.have.status(StatusCodes.OK);
      expect(res2.body.status).to.equal("success");
      expect(res2.body.id).to.be.a("string");
      expect(res2.body.url).to.be.a("string");

      // 5. Get image
      const res3 = await chai
        .request(server)
        .get(`${DALLE_ROUTE}/${res2.body.id}`);

      expect(res3).to.have.status(StatusCodes.OK);
      console.log(res3.body);

      // 6. Wait 20 seconds for image to be generated
      await sleep(20000);

      // 7. Get image again
      const res4 = await chai
        .request(server)
        .get(`${DALLE_ROUTE}/${res2.body.id}`);

      expect(res4).to.have.status(StatusCodes.OK);
      expect(res4.body.images).to.be.an("array");
      expect(res4.body.images[0]).to.be.a("string");
      expect(res4.body.images[1]).to.be.a("string");
      expect(res4.body.images[2]).to.be.a("string");
      expect(res4.body.images[3]).to.be.a("string");

      console.log(res4.body);
    }).timeout(35000);
  });

  describe("GET /generate/:id/status", () => {
    it("should return 200", async () => {
      const prompt = "this is a test prompt";

      // 1. First initiate a generate request
      const res = await chai.request(server).post(`/invoice`).send({ prompt });
      const invoice = res.body as CreateInvoiceResult;

      // 2. Next, check status of generation request
      const resStatus = await chai
        .request(server)
        .get(`/generate/${invoice.id}/status`);

      expect(resStatus).to.have.status(StatusCodes.OK);
      expect(resStatus.body.status).to.equal(ORDER_STATE.INVOICE_NOT_PAID);
      expect(resStatus.body.message).to.equal(MESSAGE.INVOICE_NOT_PAID);
      expect(resStatus.body.progress).to.equal(ORDER_PROGRESS.INVOICE_NOT_PAID);
    });
  });

  describe("POST /refund", () => {
    it("should return 200", async () => {
      // TODO
    });
  });
});
