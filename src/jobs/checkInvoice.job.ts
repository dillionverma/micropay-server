// make a bullmq worker and queue to check for lightnig invoice status

// Path: micropay-server/src/jobs/invoice.job.ts

import { Job, Queue, UnrecoverableError, Worker } from "bullmq";
import { prisma } from "../db/prisma.service";

import axios from "axios";
import { lightning } from "../server";
import { connection } from "../services/redis.service";

export interface CheckInvoiceJob {
  /* the invoice id used by lnd */
  id: string;
}

export const checkInvoiceQueue = new Queue<CheckInvoiceJob>("checkInvoice", {
  connection,
});

export const checkInvoiceWorker = new Worker<CheckInvoiceJob>(
  "checkInvoice",
  async (job: Job) => {
    console.log("Starting job", job.id);

    const { id } = job.data;
    const invoice = await lightning.getInvoice(id);

    console.log("Invoice", invoice);

    if (invoice.is_confirmed) {
      const invoiceRecord = await prisma.invoice.update({
        where: {
          invoiceId: id,
        },
        data: {
          confirmed: true,
          confirmedAt: new Date(invoice.confirmed_at),
        },
      });

      const user = await prisma.user.update({
        where: {
          id: invoiceRecord.userId,
        },
        data: {
          sats: {
            increment: invoice.tokens,
          },
        },
      });

      const res = await axios.post(
        "https://hooks.slack.com/services/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",
        {
          text: `User ${user.username} deposited ${invoice.tokens} sats 🎉`,
        }
      );
    } else if (invoice.is_canceled) {
      throw new UnrecoverableError("Invoice canceled");
    } else if (new Date(invoice.expires_at) > new Date()) {
      throw new Error("Invoice not paid yet");
    }
  },
  {
    connection,
  }
);
