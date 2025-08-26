import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Backgrounds, birds, pipes, bonuses, UI buttons

    this.load.audio('bgMusic', [
      'src/assets/background.mp3',
    ]);

    this.load.svg('background-day', '/src/assets/background-day.svg');
    this.load.svg('background-night', '/src/assets/background-night.svg');
    this.load.svg('background-space', '/src/assets/background-space.svg');
    this.load.svg('background-sunset', '/src/assets/background-sunset.svg');

    this.load.svg('bird_red', '/src/assets/bird_red.svg');
    this.load.svg('bird_blue', '/src/assets/bird_blue.svg');
    this.load.svg('bird_green', '/src/assets/bird_green.svg');

    this.load.svg('pipe', '/src/assets/pipe.svg');
    // caps for decorative top/bottom of pipe
    this.load.svg('pipe_cap', '/src/assets/pipe_cap.svg');

    this.load.svg('life', '/src/assets/life_icon.svg');

    this.load.svg('bonus_life', '/src/assets/bonus_life.svg');
    this.load.svg('bonus_harm', '/src/assets/bonus_harm.svg');
    this.load.svg('bonus_speed', '/src/assets/bonus_speed.svg');
    this.load.svg('bonus_slow', '/src/assets/bonus_slow.svg');

    this.load.svg('play_btn', '/src/assets/play_button.svg');
    this.load.svg('pause_btn', '/src/assets/pause_button.svg');

    const txt = this.add.text(this.scale.width / 2, this.scale.height / 2, 'LOADING...', { fontSize: 18 });
    txt.setOrigin(0.5);
  }

  create() {
    this.scene.start('MenuScene');
  }
}