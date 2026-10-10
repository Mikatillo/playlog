export interface AchievementStats {
  total: number;
  completed: number;
  playing: number;
  want: number;
  dropped: number;
  totalHours: number;
  ratedGames: number;
  reviewsCount: number;
}

export interface AchievementDef {
  id: string;
  title: string;
  /** Короткое описание под названием */
  description: string;
  /** Фраза для списка уровней: «{N} {unit} …» */
  unit: string;
  getValue: (s: AchievementStats) => number;
  thresholds: number[];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'collector',
    title: 'Коллекционер',
    description: 'Собери свою библиотеку игр',
    unit: 'игр в коллекции',
    getValue: (s) => s.total,
    thresholds: [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2500],
  },
  {
    id: 'finisher',
    title: 'Финишёр',
    description: 'Доходи игры до титров',
    unit: 'пройденных игр',
    getValue: (s) => s.completed,
    thresholds: [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000],
  },
  {
    id: 'hardcore',
    title: 'Хардкорщик',
    description: 'Наигрывай часы в любимых играх',
    unit: 'часов в играх',
    getValue: (s) => s.totalHours,
    thresholds: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000],
  },
  {
    id: 'critic',
    title: 'Критик',
    description: 'Ставь оценки сыгранным играм',
    unit: 'оценённых игр',
    getValue: (s) => s.ratedGames,
    thresholds: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  },
  {
    id: 'writer',
    title: 'Рецензент',
    description: 'Делись мнением в рецензиях',
    unit: 'рецензий',
    getValue: (s) => s.reviewsCount,
    thresholds: [1, 3, 5, 10, 25, 50, 100, 250, 500, 1000],
  },
  {
    id: 'explorer',
    title: 'Искатель',
    description: 'Пополняй список «Хочу пройти»',
    unit: 'игр в списке желаемого',
    getValue: (s) => s.want,
    thresholds: [1, 5, 10, 25, 50, 100, 200, 500, 1000, 2500],
  },
  {
    id: 'gamer',
    title: 'В потоке',
    description: 'Играй в несколько игр одновременно',
    unit: 'игр в процессе',
    getValue: (s) => s.playing,
    thresholds: [1, 2, 3, 5, 8, 12, 20, 35, 60, 100],
  },
  {
    id: 'perfectionist',
    title: 'Перфекционист',
    description: 'Высокая доля пройденных игр (от 5 игр в коллекции)',
    unit: '% пройденных игр',
    getValue: (s) => (s.total >= 5 ? Math.floor((s.completed / s.total) * 100) : 0),
    thresholds: [5, 10, 20, 30, 40, 50, 60, 75, 90, 100],
  },
  {
    id: 'picky',
    title: 'Привередливый',
    description: 'Не бойся бросать игры, которые не зашли',
    unit: 'заброшенных игр',
    getValue: (s) => s.dropped,
    thresholds: [1, 2, 3, 5, 10, 15, 25, 40, 60, 100],
  },
];
