import { Telegram } from "telegraf";
import { config } from "./config";

export const personalTelegram: Telegram = new Telegram(
  config.personalTelegramToken
);
export const groupTelegram: Telegram = new Telegram(config.groupTelegramToken);
