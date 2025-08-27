import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Backgrounds, birds, pipes, bonuses, UI buttons

    this.load.audio('bgMusic', [
      './assets/background.mp3',
    ]);

    this.load.svg('background-day', './assets/background-day.svg');
    this.load.svg('background-night', './assets/background-night.svg');
    this.load.svg('background-space', './assets/background-space.svg');
    this.load.svg('background-sunset', './assets/background-sunset.svg');

    this.load.svg('bird_red', './assets/bird_red.svg');
    this.load.svg('bird_blue', './assets/bird_blue.svg');
    this.load.svg('bird_green', './assets/bird_green.svg');

    this.load.svg('pipe', './assets/pipe.svg');
    // caps for decorative top/bottom of pipe
    this.load.svg('pipe_cap', './assets/pipe_cap.svg');

    this.load.svg('life', './assets/life_icon.svg');

    this.load.svg('bonus_life', './assets/bonus_life.svg');
    this.load.svg('bonus_harm', './assets/bonus_harm.svg');
    this.load.svg('bonus_speed', './assets/bonus_speed.svg');
    this.load.svg('bonus_slow', './assets/bonus_slow.svg');

    this.load.svg('play_btn', './assets/play_button.svg');
    this.load.svg('pause_btn', './assets/pause_button.svg');

    const txt = this.add.text(this.scale.width / 2, this.scale.height / 2, 'LOADING...', { fontSize: 18 });
    txt.setOrigin(0.5);
  }

  create() {
    this.scene.start('MenuScene');
  }
}