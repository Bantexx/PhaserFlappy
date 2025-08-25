import Phaser from 'phaser';
import { DIFFICULTY, SPEED_INCREASE_EVERY } from '../config.js';
import Leaderboard from '../lib/Leaderboard.js';
import TelegramWrapper from '../lib/TelegramWrapper.js';
import EventBus from '../lib/EventBus.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.isPaused = false;
  }

  init(data) {
    this.character = data.character || 'bird_red';
    this.difficultyKey = data.difficulty || 'medium';
    this.difficulty = DIFFICULTY[this.difficultyKey];

    this.score = typeof data.score === 'number' ? data.score : 0;
    this.livesCount = typeof data.livesCount === 'number' ? data.livesCount : this.difficulty.lives;
    this.pipeSpeed = typeof data.pipeSpeed === 'number' ? data.pipeSpeed : this.difficulty.pipeSpeed;
    this.nextSpeedIncreaseAt = typeof data.nextSpeedIncreaseAt === 'number' ? data.nextSpeedIncreaseAt : SPEED_INCREASE_EVERY;

    // Вспомогательные параметры для сглаженного управления
    this._scaleY = 1;               // будет выставлен в create() на основе высоты экрана
    this._gravity = 1200;           // базовая гравитация (масштабируется)
    this._jumpSpeed = 400;          // импульс вверх (масштабируется)
    this._maxVelY = 900;            // ограничение вертикальной скорости
    this._angleSmooth = 0.12;       // коэффициент сглаживания угла
    this._bobAmplitude = 6;         // амплитуда «покачивания» бонусов
    this._bobSpeed = 0.0035;        // скорость «покачивания» бонусов

    // Трекеры для бонусов/пар
    this.lastGapCenter = null;      // центр зазора предыдущей пары
    this.pairsSinceLastBonus = 0;
  }

  create() {
    TelegramWrapper.init();

    this.w = this.scale.width;
    this.h = this.scale.height;

    // Масштабирование под экран
    this._scaleY = (this.h / 640);
    this._gravity = Math.round(1200 * this._scaleY);
    this._jumpSpeed = Math.round(380 * this._scaleY);
    this._maxVelY = Math.round(900 * this._scaleY);

    // Фон
    this.bg = this.add.image(this.w / 2, this.h / 2, this.getBackgroundKeyForScore()).setDisplaySize(this.w, this.h).setDepth(0);

    // Основные размеры/зазоры
    this.pipeWidth = Phaser.Math.Clamp(Math.round(this.w * 0.08), 48, 140);
    this.baseGap = this.difficulty.gap;
    this.gap = Phaser.Math.Clamp(Math.round(this.baseGap * (this.h / 640)), Math.round(this.h * 0.18), Math.round(this.h * 0.36));
    this.minPipeHeight = Math.round(Math.max(40, this.h * 0.12));
    this.desiredSpacingPx = Math.round(Math.max(280, this.w * 0.5));

    // Группы и пулы
    this.pipesBodiesGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.bonusesGroup = this.physics.add.group({ allowGravity: false, immovable: true });

    this.pipePool = [];
    this.setupPipePool();

    this.bonusPool = [];
    this.setupBonusPool();

    // Игрок
    this.player = this.physics.add.image(this.w * 0.25, this.h / 2, this.character);
    this.player.setDisplaySize(Math.round(this.w * 0.15), Math.round(this.h * 0.08));

    // Настройка хитбокса
    const hitboxWidth = this.player.displayWidth * 0.8; // 80% от ширины спрайта
    const hitboxHeight = this.player.displayHeight * 0.6; // 60% от высоты спрайта
    this.player.body.setSize(hitboxWidth, hitboxHeight);

    // Центрирование хитбокса относительно спрайта
    const offsetX = (this.player.displayWidth - hitboxWidth);
    const offsetY = (this.player.displayHeight - hitboxHeight) / 4;
    this.player.body.setOffset(offsetX, offsetY);

    this.player.setCollideWorldBounds(true);
    this.player.body.setAllowGravity(true);
    this.player.body.setGravityY(this._gravity);
    this.player.body.setMaxVelocity(this._maxVelY, this._maxVelY);
    this.player.setDepth(30);
    this.player.setOrigin(0.5);
    this.playerAngleTarget = 0; // для сглаживания угла

    // Инпут
    this.input.on('pointerdown', this.flap, this);
    this.input.keyboard?.on('keydown-SPACE', this.flap, this);

    // Коллизии/пересечения
    this.physics.add.collider(this.player, this.pipesBodiesGroup, this.handlePipeCollision, null, this);
    this.physics.add.overlap(this.player, this.bonusesGroup, this.onCollectBonus, null, this);

    // Скорость
    this.speedMultiplier = 1;
    this.updateWorldVelocity();

    // Планировщик спавна
    this.nextSpawnTimer = null;
    this.scheduleNextSpawn(0);

    // Неуязвимость после столкновений/анимаций
    this.invulnerable = false;

    // HUD
    this.emitHUD();

    // Нужен для корректной постановки бонусов «между парами»
    this.rightmostPairRef = null; // ссылка на последнюю заспавненную пару (которая ещё активна)
    this.bg.setTexture(this.getBackgroundKeyForScore());
  }

  getBackgroundKeyForScore() {
    // Цикл каждые 40 очков: 0-9 -> morning, 10-19 -> day, 20-29 -> evening, 30-39 -> night
    const normalized = ((this.score % 40) + 40) % 40; // защитный мод, на случай отрицательных (хотя score >= 0)
    const phase = Math.floor(normalized / 10); // 0..3
    switch (phase) {
      case 0: return 'background-day';
      case 1: return 'background-sunset';
      case 2: return 'background-night';
      case 3: return 'background-space';
      default: return 'background-day';
    }
  }

  // Плавный cross-fade между текущим this.bg и новой текстурой key
  smoothTransitionBackground(key, duration = 600) {
    // Уже нужный фон — ничего не делаем
    if (this.bg && this.bg.texture && this.bg.texture.key === key) return;

    // Если уже идёт переход — аккуратно завершить/отменить его
    if (this._bgTransitionInProgress) {
      // убираем промежуточный newBg, убиваем твины и возвращаем bg в видимый вид
      if (this._bgTransitionInProgress.newBg && !this._bgTransitionInProgress.newBg.destroyed) {
        this._bgTransitionInProgress.newBg.destroy();
      }
      this.tweens.killTweensOf(this.bg);
      this.bg.setAlpha(1);
      this._bgTransitionInProgress = null;
    }

    // Создаём новый спрайт поверх старого, но с alpha 0
    const newBg = this.add.image(this.w / 2, this.h / 2, key)
      .setDisplaySize(this.w, this.h)
      .setOrigin(0.5)
      .setDepth(0)
      .setScrollFactor(0)
      .setAlpha(0);

    // Флаг/контекст текущего перехода (чтобы не стартовать новый пока идёт старый)
    this._bgTransitionInProgress = { newBg, oldBg: this.bg };

    // Твин для появления нового
    this.tweens.add({
      targets: newBg,
      alpha: 1,
      duration,
      ease: 'Sine.Out'
    });

    // Твин для скрытия старого; в onComplete заменяем this.bg и чистим
    this.tweens.add({
      targets: this.bg,
      alpha: 0,
      duration,
      ease: 'Sine.Out',
      onComplete: () => {
        // уничтожаем старый спрайт (если он ещё валиден)
        try {
          if (this._bgTransitionInProgress && this._bgTransitionInProgress.oldBg && this._bgTransitionInProgress.oldBg !== newBg) {
            this._bgTransitionInProgress.oldBg.destroy();
          }
        } catch (e) { /* silent */ }

        // делаем newBg главным фоном
        this.bg = newBg;
        this._bgTransitionInProgress = null;
      }
    });
  }

  // Более «мягкий» прыжок: прямой импульс + сглаживание угла в update()
  flap() {
    if (this.isPaused || this.invulnerable) return;
    // ограничиваем "спам" отрицательных скоростей — делаем прыжок предсказуемым
    const currentVy = this.player.body.velocity.y;
    const targetVy = -this._jumpSpeed;
    this.player.body.setVelocityY(Math.min(currentVy, targetVy));

    // быстренько поднимаем «нос» при флапе (остальное — сглаживается в update)
    this.playerAngleTarget = -28;
  }

  setupPipePool() {
    const visiblePairs = Math.ceil((this.w / this.desiredSpacingPx)) + 5;
    const poolSize = Math.max(6, visiblePairs);

    for (let i = 0; i < poolSize; i++) {
      // визуал
      const topSprite = this.add.tileSprite(-2000, -2000, this.pipeWidth, 80, 'pipe').setOrigin(0.5, 0.5).setDepth(10).setVisible(false);
      const bottomSprite = this.add.tileSprite(-2000, -2000, this.pipeWidth, 80, 'pipe').setOrigin(0.5, 0.5).setDepth(10).setVisible(false);
      const topCap = this.add.image(-2000, -2000, 'pipe_cap').setOrigin(0.5, 0.5).setDepth(11).setVisible(false);
      const bottomCap = this.add.image(-2000, -2000, 'pipe_cap').setOrigin(0.5, 0.5).setAngle(180).setDepth(11).setVisible(false);

      // физика (прямоугольники, без визуала)
      const topBody = this.add.rectangle(-2000, -2000, this.pipeWidth, 10, 0xff0000, 0);
      const bottomBody = this.add.rectangle(-2000, -2000, this.pipeWidth, 10, 0xff0000, 0);

      this.physics.add.existing(topBody);
      this.physics.add.existing(bottomBody);

      topBody.body.setAllowGravity(false);
      topBody.body.setImmovable(true);

      bottomBody.body.setAllowGravity(false);
      bottomBody.body.setImmovable(true);

      this.pipesBodiesGroup.add(topBody);
      this.pipesBodiesGroup.add(bottomBody);

      this.pipePool.push({
        topSprite,
        bottomSprite,
        topCap,
        bottomCap,
        topBody,
        bottomBody,
        active: false,
        passed: false,
        spawnX: -2000,
        gapCenterY: null
      });
    }
  }

  setupBonusPool() {
    const poolSize = 8;
    for (let i = 0; i < poolSize; i++) {
      const b = this.add.image(-2000, -2000, 'bonus_life')
        .setVisible(false)
        .setActive(false)
        .setDepth(20)
        .setScrollFactor(1);

      this.physics.add.existing(b);
      b.body.setAllowGravity(true);
      b.body.setGravityY(this._gravity * 0.3); // Бонусы падают медленнее игрока
      b.body.setImmovable(false);
      b.type = null;
      b._spawnTime = 0;
      b._isBeingCollected = false; // Инициализируем флаг сбора

      this.bonusPool.push(b);
      this.bonusesGroup.add(b);
    }
  }

  getTextureSourceSize(key) {
    try {
      const src = this.textures.get(key).getSourceImage();
      if (!src) return { w: 36, h: 36 };
      if (src.width && src.height) return { w: src.width, h: src.height };
      if (typeof src.getBBox === 'function') {
        const bb = src.getBBox();
        if (bb && bb.width && bb.height) return { w: bb.width, h: bb.height };
      }
      if (src.clientWidth && src.clientHeight) return { w: src.clientWidth, h: src.clientHeight };
    } catch (e) {}
    return { w: 36, h: 36 };
  }

  acquireBonus(type, x, y, velocityX) {
    let bonus = this.bonusPool.find(item => !item.active);
    if (!bonus) {
      bonus = this.add.image(-2000, -2000, type)
        .setVisible(false)
        .setActive(false)
        .setDepth(20)
        .setScrollFactor(1);

      this.physics.add.existing(bonus);
      bonus.body.setAllowGravity(false);
      bonus.body.setImmovable(true);
      bonus._spawnTime = 0;
      bonus._isBeingCollected = false; // Инициализируем флаг сбора

      this.bonusPool.push(bonus);
      this.bonusesGroup.add(bonus);
    }

    if (!this.textures.exists(type)) {
      // Безопасный фолбэк: если вдруг текстура не загружена
      type = 'bonus_life';
    }

    bonus.setTexture(type);
    const desired = Math.round(this.pipeWidth * 0.65);
    const src = this.getTextureSourceSize(type);
    const srcMax = Math.max(src.w || 1, src.h || 1);
    const scale = desired / srcMax;
    const finalW = Math.round((src.w || desired) * scale);
    const finalH = Math.round((src.h || desired) * scale);

    bonus.setDisplaySize(finalW, finalH);
    bonus.setPosition(x, y);
    bonus.setActive(true);
    bonus.setVisible(true);
    bonus.type = type;
    bonus._spawnTime = this.time.now;

    if (bonus.body) {
      bonus.body.setSize(finalW, finalH);
      bonus.body.setVelocityX(velocityX);
    }

    // Лёгкая анимация проявления — бонус гарантированно «виден» и заметен
    bonus.setAlpha(0);
    this.tweens.add({
      targets: bonus,
      alpha: 1,
      scale: { from: 0.9, to: 1 },
      duration: 180,
      ease: 'Back.Out'
    });

    return bonus;
  }

  releaseBonus(b) {
    if (!b) return;
    b.setActive(false);
    b.setVisible(false);
    b.setPosition(-2000, -2000);
    b.type = null;
    b._isBeingCollected = false; // Сбрасываем флаг сбора
    if (b.body) b.body.setVelocityX(0);
  }

  computeSafeBonusY(bonusX, prevX, prevGapCenter, currGapCenter) {
    const gapSize = this.gap;
    const margin = Math.round(Math.min(30, gapSize * 0.15));
    const topLimit = Math.round(this.h * 0.05);
    const spawnAreaTop = Math.round(this.h * 0.05);
    const spawnAreaBottom = Math.round(this.h * 0.25); // бонусы всё ещё рождаются в верхней части экрана
  
    // helper: получить смещённый центр в зависимости от того, верхняя/нижняя треть или нет
    const computeBiasedCenter = (center) => {
      if (center == null) return center;
      const lowerThirdY = this.h * (2 / 3);
      const upperThirdY = this.h * (1 / 3);
      // величина смещения — доля от gapSize (настраиваемо)
      const offset = Math.round(gapSize * 0.35);
  
      if (center > lowerThirdY) {
        // дыра в нижней трети -> бонус чуть выше (меньше Y)
        return center - offset;
      } else if (center < upperThirdY) {
        // дыра в верхней трети -> бонус чуть ниже (больше Y)
        return center + offset;
      }
      // средняя треть -> без смещения
      return center;
    };
  
    if (prevX == null || prevGapCenter == null) {
      const base = currGapCenter || (this.h / 2);
      const biasedBase = computeBiasedCenter(base);
  
      const minY = Math.max(topLimit, Math.round(biasedBase - gapSize / 2 + margin));
      const maxY = Math.min(spawnAreaBottom, Math.round(biasedBase + gapSize / 2 - margin));
  
      if (maxY - minY < 24) {
        const expand = 40;
        const rnd = Phaser.Math.Between(-expand, expand);
        return Phaser.Math.Clamp(Math.round(biasedBase + rnd), spawnAreaTop, spawnAreaBottom);
      }
  
      return Phaser.Math.Between(Math.round(minY), Math.round(maxY));
    }
  
    // Интерполяция по положению X между prevX..currX
    const currX = this.w + Math.max(60, this.pipeWidth);
    const denom = Math.max(1, (currX - prevX));
    const t = Phaser.Math.Clamp((bonusX - prevX) / denom, 0, 1);
    const blendedCenter = Phaser.Math.Interpolation.Linear([prevGapCenter, currGapCenter], t);
  
    // Применяем bias (выше/ниже) относительно blendedCenter
    const biasedCenter = computeBiasedCenter(blendedCenter);
  
    // Ограничиваем область появления бонуса в верхней части экрана, но в пределах отверстия (учитывая margin)
    const minY = Math.max(topLimit, Math.round(biasedCenter - gapSize / 2 + margin));
    const maxY = Math.min(spawnAreaBottom, Math.round(biasedCenter + gapSize / 2 - margin));
  
    // Если интервал слишком узкий — слегка расширяем выбор вокруг biasedCenter
    if (maxY - minY < 24) {
      const expand = 40;
      const rnd = Phaser.Math.Between(-expand, expand);
      return Phaser.Math.Clamp(Math.round(biasedCenter + rnd), spawnAreaTop, spawnAreaBottom);
    }
  
    return Phaser.Math.Between(Math.round(minY), Math.round(maxY));
  }

  spawnPipePair() {
    const spawnX = this.w + Math.max(60, this.pipeWidth);

    // Определяем центр зазора для текущей пары
    const safeMargin = this.minPipeHeight + Math.round(this.gap / 2);
    const minY = safeMargin;
    const maxY = this.h - safeMargin;
    const gapCenterY = Phaser.Math.Between(minY, maxY);

    let topHeight = Math.max(this.minPipeHeight, Math.round(gapCenterY - this.gap / 2));
    let bottomHeight = Math.max(this.minPipeHeight, Math.round(this.h - (gapCenterY + this.gap / 2)));
    const totalUsed = topHeight + bottomHeight + this.gap;
    if (totalUsed > this.h) {
      const overflow = totalUsed - this.h;
      const reduceTop = Math.round(overflow * (topHeight / (topHeight + bottomHeight)));
      const reduceBottom = overflow - reduceTop;
      topHeight = Math.max(this.minPipeHeight, topHeight - reduceTop);
      bottomHeight = Math.max(this.minPipeHeight, bottomHeight - reduceBottom);
    }

    const pair = this.pipePool.find(p => !p.active) || this.pipePool[0];
    if (!pair) return;
    const vx = -this.pipeSpeed * this.speedMultiplier;

    // TOP
    const topCenterY = topHeight / 2;
    pair.topBody.setPosition(spawnX, topCenterY);
    pair.topBody.body.setSize(this.pipeWidth, topHeight);
    pair.topBody.body.setVelocityX(vx);

    pair.topSprite.setDisplaySize(this.pipeWidth, topHeight);
    pair.topSprite.setTileScale(1, 1);
    pair.topSprite.setPosition(spawnX, topCenterY).setVisible(true);

    // Кепка
    pair.topCap.setDisplaySize(this.pipeWidth * 1.05, Math.round(this.pipeWidth * 0.45));
    pair.topCap.setPosition(spawnX, topCenterY + topHeight / 2 - (pair.topCap.displayHeight / 2)).setVisible(true);

    // BOTTOM
    const bottomCenterY = (gapCenterY + this.gap / 2) + (bottomHeight / 2);
    pair.bottomBody.setPosition(spawnX, bottomCenterY);
    pair.bottomBody.body.setSize(this.pipeWidth, bottomHeight);
    pair.bottomBody.body.setVelocityX(vx);

    pair.bottomSprite.setDisplaySize(this.pipeWidth, bottomHeight);
    pair.bottomSprite.setTileScale(1, 1);
    pair.bottomSprite.setPosition(spawnX, bottomCenterY).setVisible(true);

    // Кепка
    pair.bottomCap.setDisplaySize(this.pipeWidth * 1.05, Math.round(this.pipeWidth * 0.45));
    pair.bottomCap.setPosition(spawnX, bottomCenterY - bottomHeight / 2 + (pair.bottomCap.displayHeight / 2)).setVisible(true);

    pair.active = true;
    pair.passed = false;
    pair.spawnX = spawnX;
    pair.gapCenterY = gapCenterY;

    // === Исправленный спавн бонусов между парами ===
    // Берём фактическую X-координату правейшей активной пары на момент спавна
    const prevPairX = this.getRightmostActivePairX();
    const prevGapCenter = this.lastGapCenter;

    this.pairsSinceLastBonus++;
    const shouldSpawnBonus = (this.pairsSinceLastBonus >= 10 && Phaser.Math.Between(0, 2) === 0) || (this.pairsSinceLastBonus >= 3);

    if (shouldSpawnBonus) {
      this.pairsSinceLastBonus = 0;

      // Корректно вычисляем X между prevPairX и текущим spawnX, учитывая что prevPairX уже уехал влево
      let leftX = (prevPairX != null) ? prevPairX : (spawnX - this.desiredSpacingPx);
      let rightX = spawnX;

      // Немного безопасного отступа от самих труб
      const marginX = Math.round(this.pipeWidth * 0.8);
      leftX += marginX;
      rightX -= marginX;

      // Если отрезок выродился — ставим минимум на полпути
      if (rightX - leftX < 40) {
        leftX = spawnX - Math.round(this.desiredSpacingPx * 0.65);
        rightX = spawnX - Math.round(this.desiredSpacingPx * 0.35);
      }

      const bonusX = Phaser.Math.Clamp(Math.round(Phaser.Math.Linear(leftX, rightX, 0.5)), this.w * 0.15, spawnX - marginX);

      const chosenY = this.computeSafeBonusY(bonusX, prevPairX, prevGapCenter, gapCenterY);
      const types = ['bonus_life', 'bonus_harm', 'bonus_speed', 'bonus_slow'];
      const t = Phaser.Utils.Array.GetRandom(types);
      const b = this.acquireBonus(t, bonusX, chosenY, vx);
      b.setDepth(20);

      // Немного «покачивания», чтобы заметнее в любом фоне
      b._spawnTime = this.time.now;
    }

    // обновляем трекеры
    this.lastGapCenter = gapCenterY;
    this.rightmostPairRef = pair;
  }

  // Фактический X правейшей активной пары (для бонусов между парами)
  getRightmostActivePairX() {
    let maxX = null;
    for (const pair of this.pipePool) {
      if (!pair.active) continue;
      const x = pair.topBody.x; // обе части совпадают по X
      if (maxX == null || x > maxX) {
        maxX = x;
      }
    }
    return maxX;
  }

  scheduleNextSpawn(delayMs = null) {
    if (this.nextSpawnTimer) {
      this.nextSpawnTimer.remove(false);
      this.nextSpawnTimer = null;
    }
    const currentSpeed = Math.max(10, this.pipeSpeed * this.speedMultiplier);
    const delay = delayMs !== null ? delayMs : Math.max(600, Math.round((this.desiredSpacingPx / currentSpeed) * 1000));
    this.nextSpawnTimer = this.time.delayedCall(delay, () => {
      this.spawnPipePair();
      this.scheduleNextSpawn();
    });
  }

  handlePipeCollision(player, pipeBody) {
    if (this.invulnerable) return;

    this.livesCount = Math.max(0, this.livesCount - 1);
    this.emitHUD();

    this.cameras.main.shake(140, 0.015);

    if (this.livesCount <= 0) {
      this.time.delayedCall(180, () => this.gameOver());
    } else {
      const preserved = {
        score: this.score,
        livesCount: this.livesCount,
        pipeSpeed: this.pipeSpeed,
        nextSpeedIncreaseAt: this.nextSpeedIncreaseAt,
        character: this.character,
        difficulty: this.difficultyKey
      };
      this.time.delayedCall(160, () => {
        if (this.nextSpawnTimer) this.nextSpawnTimer.remove(false);
        this.scene.restart(preserved);
      });
    }
  }

  onCollectBonus(player, bonus) {
    // Дополнительная защита от повторного срабатывания
    if (!bonus.active || bonus._isBeingCollected) return;
    bonus._isBeingCollected = true;
    
    const type = bonus.type;
    switch (type) {
      case 'bonus_life':
        this.livesCount += 1;
        break;
      case 'bonus_harm':
        this.livesCount = Math.max(0, this.livesCount - 1);
        break;
      case 'bonus_speed':
        this.changeSpeed(1.4, 5000);
        break;
      case 'bonus_slow':
        this.changeSpeed(0.7, 5000);
        break;
      default:
        break;
    }

    // Маленький фидбек при сборе
    this.tweens.add({
      targets: bonus,
      scale: { from: bonus.scale, to: bonus.scale * 1.2 },
      alpha: { from: 1, to: 0 },
      duration: 120,
      ease: 'Quad.Out',
      onComplete: () => this.releaseBonus(bonus)
    });

    this.emitHUD();

    if (this.livesCount <= 0) {
      this.time.delayedCall(120, () => this.gameOver());
    }
  }

  // Централизованно применяем новую горизонтальную скорость ко всем «движущимся» объектам
  updateWorldVelocity() {
    const vx = -this.pipeSpeed * this.speedMultiplier;
    for (const pair of this.pipePool) {
      if (!pair.active) continue;
      pair.topBody.body.setVelocityX(vx);
      pair.bottomBody.body.setVelocityX(vx);
    }
    this.bonusesGroup.children.iterate((b) => {
      if (b && b.body && b.active) b.body.setVelocityX(vx);
    });
  }

  changeSpeed(multiplier, duration = 4000) {
    this.speedMultiplier = multiplier;
    this.updateWorldVelocity();

    // Пересчёт будущих спавнов по текущей скорости
    this.scheduleNextSpawn();

    this.time.delayedCall(duration, () => {
      this.speedMultiplier = 1;
      this.updateWorldVelocity();
      this.scheduleNextSpawn();
    });
  }

  update(time, delta) {
    if (this.isPaused) return;

    // Плавное управление: угол не скачет, медленно «догоняет» целевой
    const vy = this.player.body.velocity.y;
    // Целевой угол по скорости: лёгкий наклон вверх при флапе и вниз при падении
    const targetAngle = Phaser.Math.Clamp(Phaser.Math.Linear(-30, 70, Phaser.Math.Clamp((vy + 300) / 900, 0, 1)), -30, 70);
    // Если недавно был флап — даём приоритет кратковременному «нос вверх»
    const blendedTarget = Math.min(this.playerAngleTarget, targetAngle);
    this.player.angle = Phaser.Math.Linear(this.player.angle, blendedTarget, this._angleSmooth);
    // Постепенно «забываем» флап-наклон
    this.playerAngleTarget = Phaser.Math.Linear(this.playerAngleTarget, targetAngle, 0.08);

    // Ограничение скорости вниз (защита от чрезмерного «пикирования»)
    if (vy > this._maxVelY) {
      this.player.body.setVelocityY(this._maxVelY);
    }

    // Синхронизация визуала труб с физикой и подсчёт очков
    for (const pair of this.pipePool) {
      if (!pair.active) continue;

      pair.topSprite.setPosition(pair.topBody.x, pair.topBody.y);
      pair.bottomSprite.setPosition(pair.bottomBody.x, pair.bottomBody.y);

      const topHalf = (pair.topBody.body && pair.topBody.body.height) ? pair.topBody.body.height / 2 : pair.topSprite.displayHeight / 2;
      const bottomHalf = (pair.bottomBody.body && pair.bottomBody.body.height) ? pair.bottomBody.body.height / 2 : pair.bottomSprite.displayHeight / 2;

      pair.topCap.setPosition(pair.topBody.x, pair.topBody.y + topHalf - (pair.topCap.displayHeight / 2));
      pair.bottomCap.setPosition(pair.bottomBody.x, pair.bottomBody.y - bottomHalf + (pair.bottomCap.displayHeight / 2));

      if (!pair.passed && (pair.topBody.x + (this.pipeWidth / 2) < this.player.x)) {
        pair.passed = true;
        this.score += 1;
        this.onScoreChanged();
      }

      if (pair.topBody.x + (this.pipeWidth / 2) < -150) {
        pair.active = false;
        pair.passed = false;
        pair.gapCenterY = null;
        pair.topBody.setPosition(-2000, -2000);
        pair.bottomBody.setPosition(-2000, -2000);
        pair.topSprite.setVisible(false).setPosition(-2000, -2000);
        pair.bottomSprite.setVisible(false).setPosition(-2000, -2000);
        pair.topCap.setVisible(false).setPosition(-2000, -2000);
        pair.bottomCap.setVisible(false).setPosition(-2000, -2000);
        pair.topBody.body.setVelocityX(0);
        pair.bottomBody.body.setVelocityX(0);
      }
    }

    // Живучесть бонусов вне экрана и «покачивание» для заметности
    this.bonusesGroup.children.iterate((b) => {
      if (!b || !b.active) return;
      if (b.x < -200) {
        this.releaseBonus(b);
        return;
      }
      // Bobbing (визуально заметнее)
      const t = (this.time.now - (b._spawnTime || 0));
      const offset = Math.sin(t * this._bobSpeed) * this._bobAmplitude;
      b.setY(b.y + offset * (delta / 16.666)); // фрейм-независимо
    });

    // Фон по очкам
    const desiredBg = this.getBackgroundKeyForScore();
    if (!this.bg || this.bg.texture.key !== desiredBg) {
      this.smoothTransitionBackground(desiredBg, 600); // 600ms — длительность перехода, можно менять
    }
    if (this.bg.texture.key !== desiredBg) this.bg.setTexture(desiredBg);
  }

  onScoreChanged() {
    this.emitHUD();

    if (this.score >= this.nextSpeedIncreaseAt) {
      this.pipeSpeed = Math.round(this.pipeSpeed + 20);
      this.nextSpeedIncreaseAt += SPEED_INCREASE_EVERY;
      this.updateWorldVelocity();
      this.scheduleNextSpawn();
    }
  }

  emitHUD() {
    const livesArr = Array.from({ length: Math.max(0, this.livesCount) }, () => 1);
    EventBus.emit('updateHUD', { score: this.score, lives: livesArr, difficultyName: this.difficulty.name, speed: this.pipeSpeed });
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.world.pause();
      if (this.nextSpawnTimer) this.nextSpawnTimer.paused = true;
      const w = this.w, h = this.h;
      this.pauseOverlay = this.add.rectangle(w / 2, h / 2, w * 0.9, h * 0.4, 0x000000, 0.6).setDepth(1000);
      this.pauseText = this.add.text(w / 2, h / 2, 'ПАУЗА\nНажмите чтобы продолжить', { fontSize: 20, color: '#fff', align: 'center' }).setOrigin(0.5).setInteractive().setDepth(1001);
      this.pauseText.on('pointerup', () => this.togglePause());
    } else {
      if (this.pauseOverlay) {
        this.pauseOverlay.destroy();
        this.pauseText.destroy();
        this.pauseOverlay = null;
      }
      this.physics.world.resume();
      if (this.nextSpawnTimer) this.nextSpawnTimer.paused = false;
    }
  }

  gameOver() {
    if (this.nextSpawnTimer) this.nextSpawnTimer.remove(false);
    this.physics.world.pause();
    Leaderboard.addLocal('Player', this.score);

    this.scene.stop('UIScene');
    this.scene.start('GameOverScene', { score: this.score });
  }
}