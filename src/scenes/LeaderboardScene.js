import Phaser from 'phaser';
import Leaderboard from '../lib/Leaderboard.js';

export default class LeaderboardScene extends Phaser.Scene {
  constructor() {
    super('LeaderboardScene');
  }

  async create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w * 0.9, h * 0.9, 0x000000, 0.8);

    this.add.text(w / 2, h * 0.12, 'Локальная таблица лидеров', { fontSize: 20, color: '#fff' }).setOrigin(0.5);
    const l = Leaderboard.getLocal(10);

    l.forEach((item, idx) => {
      this.add.text(w / 2, h * 0.18 + idx * 28, `${idx + 1}. ${item.name} — ${item.score}`, { fontSize: 16, color: '#fff' }).setOrigin(0.5);
    });

    const back = this.add.text(w / 2, h * 0.88, '← Назад', { fontSize: 16, color: '#fff' }).setOrigin(0.5).setInteractive();
    back.on('pointerup', () => {
      this.scene.start('MenuScene');
    });
  }
}