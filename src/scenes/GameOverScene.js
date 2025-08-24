import Phaser from 'phaser';
import Leaderboard from '../lib/Leaderboard.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.score = data.score || 0;
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w * 0.9, h * 0.7, 0x111111, 0.85);
    this.add.text(w / 2, h * 0.28, 'Game Over', { fontSize: 32, color: '#fff' }).setOrigin(0.5);
    this.add.text(w / 2, h * 0.38, `Очки: ${this.score}`, { fontSize: 22, color: '#fff' }).setOrigin(0.5);

    const tryBtn = this.add.text(w / 2, h * 0.55, 'Попробовать снова', { fontSize: 18, backgroundColor: '#00aa00', color: '#fff', padding: { x: 12, y: 8 } }).setOrigin(0.5).setInteractive();
    tryBtn.on('pointerup', () => {
      this.scene.start('SelectScene');
    });

    const menuBtn = this.add.text(w / 2, h * 0.68, 'В главное меню', { fontSize: 16, backgroundColor: '#666', color: '#fff', padding: { x: 12, y: 8 } }).setOrigin(0.5).setInteractive();
    menuBtn.on('pointerup', () => {
      this.scene.start('MenuScene');
    });

    // show local leaderboard top 5
    const l = Leaderboard.getLocal(5);
    let y = h * 0.78;
    this.add.text(w / 2, h * 0.48, 'Лучшие (локальные):', { fontSize: 14, color: '#fff' }).setOrigin(0.5);

    l.forEach((item, idx) => {
      this.add.text(w / 2, y + idx * 22, `${idx + 1}. ${item.name} — ${item.score}`, { fontSize: 14, color: '#fff' }).setOrigin(0.5);
    });
  }
}