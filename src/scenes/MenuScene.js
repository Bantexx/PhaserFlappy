import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.sound.stopAll();
    this.bgMusic = this.sound.add('bgMusic', { loop: true, volume: 0.5 });
    this.bgMusic.play();

    this.add.image(w / 2, h / 2, 'background-day').setDisplaySize(w, h);

    const title = this.add.text(w / 2, h * 0.15, 'FLAPPY MINI', {
      fontSize: Math.round(Math.min(w, h) * 0.07),
      fontWeight: '700',
      color: '#fff'
    }).setOrigin(0.5);

    const playBtn = this.add.image(w / 2, h * 0.45, 'play_btn').setInteractive({ useHandCursor: true });
    playBtn.setDisplaySize(Math.min(w, 160), Math.min(h, 80));
    playBtn.on('pointerup', () => {
      this.scene.start('SelectScene');
    });

    const leaderBtn = this.add.text(w / 2, h * 0.6, 'Таблица лидеров', { fontSize: 18, color: '#fff' }).setOrigin(0.5).setInteractive();
    leaderBtn.on('pointerup', () => {
      this.scene.start('LeaderboardScene');
    });

    const credits = this.add.text(w / 2, h * 0.9, 'Tap для управления. Поддержка Telegram WebApp.', { fontSize: 12, color: '#fff' }).setOrigin(0.5);

    // simple hint
    this.input.on('pointerdown', () => {
      // small particle or sound may be added
    });
  }
}