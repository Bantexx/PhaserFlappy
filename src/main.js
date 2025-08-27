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
  backgroundColor: '#87ceeb',
  width: 720,
  height: 1280,
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
});