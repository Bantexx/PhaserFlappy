export default class TelegramWrapper {
    static get tg() {
      return window.Telegram ? window.Telegram.WebApp : null;
    }
  
    static init() {
      if (this.tg) {
        try {
          this.tg.expand();
        } catch (e) {
          // ignore
        }
      }
    }
  
    // отправить данные боту (строка) — зависит от вашего бота, но WebApp API позволяет sendData
    static sendData(data) {
      if (!this.tg) {
        console.warn('Telegram WebApp not available');
        return;
      }
      try {
        this.tg.sendData(JSON.stringify(data));
      } catch (e) {
        console.error('tg.sendData error', e);
      }
    }
  }