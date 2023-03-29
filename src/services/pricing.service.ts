import axios from "axios";
import { SATOSHI_PER_BTC } from "../consts";
import { prisma } from "../db/prisma.service";
import { TaskParams } from "../jobs/task.job";

export default class Pricing {
  constructor() {}

  getPrice = async (
    modelId: string,
    modelInputs: TaskParams
  ): Promise<number> => {
    const model = await prisma.model.findUnique({
      where: {
        id: modelId,
      },
    });

    const bitcoinPrice = await this.getBitcoinPrice();
    console.log("EEE", bitcoinPrice);
    const price = model.unitPriceUSD * modelInputs.num_images;
    return Math.ceil((price * SATOSHI_PER_BTC) / bitcoinPrice);
  };

  getBitcoinPrice = async (): Promise<number> => {
    const bitcoinPrice = await axios.get(
      "https://api.coindesk.com/v1/bpi/currentprice.json"
    );
    return bitcoinPrice.data.bpi.USD.rate_float;
  };
}
