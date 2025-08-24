import Phaser from 'phaser';

/*
  Общий EventBus (Phaser EventEmitter), который используется
  для связи между сценами (HUD и GameScene). Это позволяет
  полностью рестартовать GameScene без разрыва связи с UIScene.
*/
const EventBus = new Phaser.Events.EventEmitter();

export default EventBus;