import Phaser from 'phaser';
import { DIFFICULTY } from '../config.js';

export default class SelectScene extends Phaser.Scene {
  constructor() {
    super('SelectScene');
  }

  create() {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.image(w / 2, h / 2, 'bg_day').setDisplaySize(w, h);

    const header = this.add.text(w / 2, h * 0.08, 'Выберите персонажа и сложность', { fontSize: 18, color: '#fff' }).setOrigin(0.5);

    // characters
    const chars = ['bird_red', 'bird_blue', 'bird_green'];
    this.selectedChar = chars[0];

    const cx = w * 0.2;
    const gap = w * 0.25;
    chars.forEach((c, i) => {
      const img = this.add.image(cx + gap * i, h * 0.35, c).setInteractive({ useHandCursor: true });
      img.setDisplaySize(80, 80);
      img.on('pointerup', () => {
        this.selectedChar = c;
        charsImages.forEach(it => it.clearTint());
        img.setTint(0x00ff88);
      });
    });

    const charsImages = this.children.list.filter(c => c.texture && chars.includes(c.texture.key));

    // difficulties
    const diffKeys = Object.keys(DIFFICULTY);
    this.selectedDiff = 'medium';
    const diffGroup = this.add.group();
    diffKeys.forEach((k, i) => {
      const conf = DIFFICULTY[k];
      const x = w * 0.15 + i * (w * 0.28);
      const b = this.add.text(x, h * 0.6, `${conf.name}\nLives: ${conf.lives}`, {
        fontSize: 16,
        backgroundColor: k === this.selectedDiff ? '#ffaa00' : '#ffffff22',
        padding: { x: 12, y: 8 },
        align: 'center'
      }).setOrigin(0.5).setInteractive();
      b.on('pointerup', () => {
        this.selectedDiff = k;
        // update style
        diffKeys.forEach((kk) => {
          const idx = diffKeys.indexOf(kk);
          diffGroup.getChildren()[idx].setStyle({ backgroundColor: kk === this.selectedDiff ? '#ffaa00' : '#ffffff22' });
        });
      });
      diffGroup.add(b);
    });

    const startBtn = this.add.text(w / 2, h * 0.82, 'Начать', { fontSize: 20, backgroundColor: '#00aa00', color: '#fff', padding: { x: 16, y: 10 } }).setOrigin(0.5).setInteractive();
    startBtn.on('pointerup', () => {
      this.scene.start('GameScene', { character: this.selectedChar, difficulty: this.selectedDiff });
      this.scene.launch('UIScene'); // HUD
    });

    const back = this.add.text(20, 20, '← Назад', { fontSize: 14, color: '#fff' }).setInteractive();
    back.on('pointerup', () => {
      this.scene.start('MenuScene');
    });
  }
}