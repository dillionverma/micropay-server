import { Telegram } from "telegraf";

export class TelegramBot {
  private personal: Telegram;
  private group: Telegram;
  private adminIds: string[];
  private groupId: string;

  constructor(
    personalToken: string,
    groupToken: string,
    adminIds: string[],
    groupId: string
  ) {
    this.adminIds = adminIds;
    this.groupId = groupId;
    this.personal = new Telegram(personalToken);
    this.group = new Telegram(groupToken);
  }

  public async sendMessageToAdmins(message: string): Promise<void> {
    // Don't send to admins if in CI
    if (process.env.CI) return;

    for (const id of this.adminIds) {
      await this.personal.sendMessage(id, message);
    }
  }

  public async sendImagesToAdmins(
    images: string[],
    caption: string
  ): Promise<void> {
    // Don't send to admins if in CI
    if (process.env.CI) return;

    for (const id of this.adminIds) {
      await this.personal.sendMediaGroup(
        id,
        images.map((media, i) => ({
          type: "photo",
          media,
          caption: i === 0 ? caption : "",
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

    await this.group.sendMediaGroup(
      this.groupId,
      images.map((media, i) => ({
        type: "photo",
        media,
        caption: i === 0 ? caption : "",
      }))
    );
  }
}
