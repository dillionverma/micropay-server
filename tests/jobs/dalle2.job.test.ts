import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import chaiHttp from "chai-http";
import sinon, { SinonStub } from "sinon";
import sinonChai from "sinon-chai";
import { generationQueue, generationWorker } from "../../src/jobs/dalle2.job";
import { aws, dalle2, lightning, telegramBot } from "../../src/server";

chai.use(chaiAsPromised);
chai.use(chaiHttp);
chai.use(sinonChai);
const expect = chai.expect;

const prompt: string =
  "a matte painting of a girl with a backpack and a smartphone that traveled back in time to an ancient Greek colosseum with gladiators, showing her back";

describe("Dalle2 Job", () => {
  let dalle2Spy: SinonStub;
  let lightningSpy: SinonStub;
  let awsSpy: SinonStub;
  let telegramAdminMessageSpy: SinonStub;
  let telegramAdminImagesSpy: SinonStub;
  let telegramGroupSpy: SinonStub;

  afterEach(() => {
    dalle2Spy.restore();
    lightningSpy.restore();
    awsSpy.restore();
    telegramAdminMessageSpy.restore();
    telegramAdminImagesSpy.restore();
    telegramGroupSpy.restore();
  });

  describe("generate", async () => {
    it("should successfully generate images, upload to s3, and ping telegram", async () => {
      const invoiceId = "1";

      dalle2Spy = sinon.stub(dalle2, "generate").resolves([
        {
          generationId: "generation-1",
          publicUrl: "test1.png",
          downloadUrl: "test1.png",
          imageBuffer: Buffer.from("aaa", "hex"),
        },
        {
          generationId: "generation-2",
          publicUrl: "test2.png",
          downloadUrl: "test2.png",
          imageBuffer: Buffer.from("aaa", "hex"),
        },
        {
          generationId: "generation-3",
          publicUrl: "test3.png",
          downloadUrl: "test3.png",
          imageBuffer: Buffer.from("aaa", "hex"),
        },
        {
          generationId: "generation-4",
          publicUrl: "test4.png",
          downloadUrl: "test4.png",
          imageBuffer: Buffer.from("aaa", "hex"),
        },
      ]);
      lightningSpy = sinon.stub(lightning, "getInvoice").resolves({
        chain_address: undefined,
        cltv_delta: 40,
        confirmed_at: undefined,
        created_at: "2022-10-20T21:26:55.000Z",
        description:
          'Dalle-2 generate: "a matte painting of a girl with a backpack and a smartphone that traveled back in time to an ancient Greek colosseum with gladiators, showing her back"',
        description_hash: undefined,
        expires_at: "2022-10-21T00:26:55.000Z",
        features: [
          { bit: 9, is_known: true, is_required: false, type: "tlv_onion" },
          {
            bit: 14,
            is_known: true,
            is_required: true,
            type: "payment_identifier",
          },
          {
            bit: 17,
            is_known: true,
            is_required: false,
            type: "multipath_payments_v0",
          },
        ],
        id: "e8fc026f43e544e22d8e54e029b0d3ffd519c76d591c9520d601f9c864a59440",
        is_canceled: undefined,
        is_confirmed: true,
        is_held: undefined,
        is_private: false,
        is_push: undefined,
        payment:
          "b080f818cbd67e184bae1e1093668dbddab3c31719c510fb5c2cb794de9b08d5",
        payments: [],
        received: 0,
        received_mtokens: "0",
        request:
          "lnbc500n1p34r0glpp5ar7qym6ru4zwytvw2nsznvxnll23n3mdtywf2gxkq8uuse99j3qqdyyg3skcmr995ezqem9dejhyct5v5azqgnpdcsxzum5wfhkuct4wssxcmm4denkjmn8yp5kugrpyp68ymmsd93kzmpqwfjhxmmjwssxjm3qwdcxzcm99ss8q6tcv4kzqctjws3qcqzpgxqr23ssp5kzq0sxxt6elpsjawrcgfxe5dhhdt8schr8z3p76u9jmefh5mpr2s9qyyssq3cm55jhylsp427w540tqduelk2fl6jdpja59qtwm3wcke3pqwrnrvzdm5k5vjz3y8t733qjadkkcjdmspddf709654rq9ph4cnag32gqsenpdx",
        secret:
          "d34a6f632712b742962cd54153350df2bbad1be2ad965c50edad403ea6fa7dbb",
        tokens: 50,
      });

      awsSpy = sinon.stub(aws, "uploadImageBufferToS3").resolves("test.png");

      telegramAdminMessageSpy = sinon
        .stub(telegramBot, "sendImagesToAdmins")
        .resolves();
      telegramAdminImagesSpy = sinon
        .stub(telegramBot, "sendMessageToAdmins")
        .resolves();
      telegramGroupSpy = sinon
        .stub(telegramBot, "sendImagesToGroup")
        .resolves();

      const job = await generationQueue.add(
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
          jobId: invoiceId,
        }
      );

      await new Promise((resolve) => generationWorker.on("completed", resolve));

      expect(await job.getState()).to.equal("completed");
      expect(awsSpy).to.have.callCount(4);
      expect(telegramAdminMessageSpy).to.have.been.calledOnce;
      expect(telegramAdminImagesSpy).to.have.been.calledOnce;
      expect(telegramGroupSpy).to.have.been.calledOnce;
    });
  });
});
