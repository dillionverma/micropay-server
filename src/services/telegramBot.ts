import { Telegram } from "telegraf";

export class TelegramBot {
  private privateNotifierBot: Telegram;
  private generationsBot: Telegram;
  private adminIds: string[];
  private generationsBotId: string;

  constructor(
    privateNotifierBotToken: string,
    generationsBotToken: string,
    adminIds: string[],
    generationsBotId: string
  ) {
    this.adminIds = adminIds;
    this.generationsBotId = generationsBotId;
    this.privateNotifierBot = new Telegram(privateNotifierBotToken);
    this.generationsBot = new Telegram(generationsBotToken);
  }

  public async sendMessageToAdmins(message: string): Promise<void> {
    // Don't send to admins if in CI
    if (process.env.CI) return;

    if (process.env.NODE_ENV !== "production") return;

    for (const adminId of this.adminIds) {
      await this.privateNotifierBot.sendMessage(adminId, message);
    }
  }

  public async sendImagesToAdmins(
    images: string[],
    caption: string
  ): Promise<void> {
    // Don't send to admins if in CI
    if (process.env.CI) return;

    for (const id of this.adminIds) {
      await this.privateNotifierBot.sendMediaGroup(
        id,
        images.map((image, index) => ({
          type: "photo",
          media: image,
          caption: index === 0 ? caption : "",
        }))
      );
    }
  }

  public async sendImagesToGroup(
    images: string[],
    caption: string
  ): Promise<void> {
    // Only send to group telegram if not in dev
    if (process.env.NODE_ENV !== "production") return;

    await this.generationsBot.sendMediaGroup(
      this.generationsBotId,
      images.map((image, index) => ({
        type: "photo",
        media: image,
        caption: index === 0 ? caption : "",
      }))
    );
  }
}
