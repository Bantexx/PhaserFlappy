import Phaser from 'phaser';
import EventBus from '../lib/EventBus.js';

export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UIScene');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;

    this.scoreText = this.add.text(12, 12, 'Очки: 0', { fontSize: 18, color: '#fff' });

    this.diffText = this.add.text(12, 36, '', { fontSize: 14, color: '#fff' });

    this.livesGroup = this.add.group();

    this.pauseBtn = this.add.image(w - 40, 30, 'pause_btn').setInteractive({ useHandCursor: true }).setDisplaySize(48, 48);
    this.pauseBtn.on('pointerup', () => {
      const gameScene = this.scene.get('GameScene');
      if (gameScene) gameScene.togglePause();
    });

    // subscribe to EventBus updates (persistent across GameScene restart)
    EventBus.on('updateHUD', this.updateHUD, this);

    // When UIScene is shutdown (e.g. on GameOverScene we do this.scene.stop('UIScene'))
    this.events.on('shutdown', () => {
      EventBus.off('updateHUD', this.updateHUD, this);
    });
  }

  updateHUD({ score, lives, difficultyName }) {
    if (typeof score === 'number') {
      this.scoreText.setText(`Очки: ${score}`);
    }
    if (typeof difficultyName !== 'undefined') {
      this.diffText.setText(`Сложность: ${difficultyName}`);
    }
    if (Array.isArray(lives)) {
      // clear and render lives
      this.livesGroup.clear(true, true);
      let x = 12;
      const y = 60;
      lives.forEach((l, i) => {
        const icon = this.add.image(x + i * 26, y, 'life').setDisplaySize(22, 22);
        this.livesGroup.add(icon);
      });
    }
  }
}