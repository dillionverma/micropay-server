import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";
import { Application } from "express";
import { StatusCodes } from "http-status-codes";
import { CreateInvoiceResult } from "lightning";
import { config } from "../src/config";
import { init, MESSAGE, ORDER_PROGRESS, ORDER_STATE } from "../src/server";

chai.use(chaiAsPromised);
chai.use(chaiHttp);
const expect = chai.expect;

describe("api", () => {
  let server: Application;

  before(() => {
    console.log("CONFIG", config);
    server = init({ ...config, port: 3004 });
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
      const uuid = "3cfc5728-cf13-430c-a277-f4ecb59a1d01"; // An invoice ID generated for testing purposes
      const rating = 5;
      const feedback = "test";
      const res = await chai
        .request(server)
        .post("/feedback")
        .send({ uuid, rating, feedback });

      expect(res.status).to.equal(StatusCodes.OK);
    });

    it("should return 500 if non-existant invoice id", async () => {
      const uuid = "test";
      const rating = 2;
      const feedback = "sad";
      const res = await chai
        .request(server)
        .post("/feedback")
        .send({ uuid, rating, feedback });

      expect(res.status).to.equal(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("POST /invoice", () => {
    it("should return 200", async () => {
      const prompt = "this is a test prompt";
      const res = await chai.request(server).post(`/invoice`).send({ prompt });
      const invoice = res.body as { id: string; uuid: string; request: string };

      expect(res).to.have.status(StatusCodes.OK);
      // expect(invoice.chain_address).to.be.undefined;
      // expect(invoice.description).to.equal(`Dalle-2 generate: "${prompt}"`);
      expect(invoice.id).to.be.a("string");
      expect(invoice.uuid).to.be.a("string");
      // expect(invoice.mtokens).to.be.a("string");
      // expect(invoice.payment).to.be.a("string");
      expect(invoice.request).to.be.a("string");
      // expect(invoice.secret).to.be.a("string");
      // expect(invoice.tokens).to.equal(50);
    });
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
