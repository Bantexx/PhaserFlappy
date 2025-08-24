export const DIFFICULTY = {
    easy: {
      name: 'ЛЕГКАЯ',
      lives: 5,
      pipeSpeed: 180,
      gap: 180
    },
    medium: {
      name: 'СРЕДНЯЯ',
      lives: 3,
      pipeSpeed: 240,
      gap: 140
    },
    hard: {
      name: 'СЛОЖНАЯ',
      lives: 1,
      pipeSpeed: 320,
      gap: 110
    }
  };
  
  export const BG_THRESHOLDS = [0, 10, 25, 50]; // очки при которых сменяется фон
  export const SPEED_INCREASE_EVERY = 10; // каждые X очков увеличиваем скорость