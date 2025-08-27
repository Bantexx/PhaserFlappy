import Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import MenuScene from './scenes/MenuScene.js';
import SelectScene from './scenes/SelectScene.js';
import GameScene from './scenes/GameScene.js';
import UIScene from './scenes/UIScene.js';
import GameOverScene from './scenes/GameOverScene.js';
import LeaderboardScene from './scenes/LeaderboardScene.js';

// Logical phone size (portrait)
const PHONE_WIDTH = window.innerWidth * window.devicePixelRatio;
const PHONE_HEIGHT = window.innerHeight * window.devicePixelRatio;

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: PHONE_WIDTH,
  height: PHONE_HEIGHT,
  backgroundColor: '#87ceeb',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: true
    }
  },
  scale: {
    mode: Phaser.Scale.FIT, // will fit container but logical size is phone size
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, MenuScene, SelectScene, GameScene, UIScene, GameOverScene, LeaderboardScene]
};

window.addEventListener('load', () => {
  const game = new Phaser.Game(config);

  // resize canvas when window resizes to maintain fit in container
  window.addEventListener('resize', () => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;
    const gameRatio = config.width / config.height;

    var width = 0;
    var height = 0;

    if (windowRatio < gameRatio) {
      width = windowWidth;
      height = (windowWidth / gameRatio);
    } else {
      width = (windowHeight * gameRatio);
      height = windowHeight;
    }
    game.scale.resize(width, height);
  });
});