import fetch from "node-fetch";
import { log } from "./log";
import { Notifications } from "./configuration";

export class Notifier {
  private notificationsDetails?: Notifications;

  constructor(notificationsDetails?: Notifications) {
    this.notificationsDetails = notificationsDetails;
    if (!notificationsDetails?.telegramToken) log.warn(`No telegramToken/telegramChatId specified, will log but not publish to Telegram!`);
  }

  async publish(msg: string) {
    log.info(msg);
    if (this.notificationsDetails?.telegramToken && this.notificationsDetails?.telegramChatId) {
      const resp = await fetch(`https://api.telegram.org/bot${this.notificationsDetails.telegramToken}/sendMessage`, {
        method: `POST`,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.notificationsDetails.telegramChatId,
          text: msg,
        }),
      });
      log.debug(`Response for telegram POST ${JSON.stringify(resp)}`);
    } else {
      log.debug(`Failed to publish the message due to undefined telegramChatId/telegramToken`);
    }
  }
}
