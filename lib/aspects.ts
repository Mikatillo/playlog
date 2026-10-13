// Оценка по аспектам: 4 ползунка вместо одной цифры → «радар вкуса» в профиле

export type AspectKey = 'gameplay' | 'story' | 'visuals' | 'music';
export type Aspects = Record<AspectKey, number>; // 0 = не оценено, 1–10 = оценка

export interface AspectMeta {
  key: AspectKey;
  column: string;
  label: string;
  hint: string;
  color: string;
  /** как зовут игрока, у которого этот аспект на первом месте */
  archetype: string;
  archetypeHint: string;
}

export const ASPECTS: AspectMeta[] = [
  {
    key: 'gameplay', column: 'rate_gameplay', label: 'Геймплей', color: '#818cf8',
    hint: 'Механики, управление, интересно ли играть',
    archetype: 'Геймплеёр', archetypeHint: 'Для тебя главное — как игра ощущается в руках',
  },
  {
    key: 'story', column: 'rate_story', label: 'Сюжет', color: '#fb7185',
    hint: 'История, персонажи, диалоги',
    archetype: 'Сюжетник', archetypeHint: 'Ты играешь ради истории и героев',
  },
  {
    key: 'visuals', column: 'rate_visuals', label: 'Графика', color: '#34d399',
    hint: 'Картинка, стиль, атмосфера мира',
    archetype: 'Эстет', archetypeHint: 'Для тебя важны красота и стиль мира',
  },
  {
    key: 'music', column: 'rate_music', label: 'Музыка', color: '#fbbf24',
    hint: 'Саундтрек и звук',
    archetype: 'Меломан', archetypeHint: 'Ты слушаешь игру так же внимательно, как смотришь',
  },
];

export const emptyAspects = (): Aspects => ({ gameplay: 0, story: 0, visuals: 0, music: 0 });

export function aspectsFromRow(row: any): Aspects {
  const a = emptyAspects();
  if (!row) return a;
  ASPECTS.forEach((m) => {
    const v = Number(row[m.column]);
    a[m.key] = Number.isFinite(v) && v >= 1 && v <= 10 ? Math.round(v) : 0;
  });
  return a;
}

export const hasAspects = (a?: Aspects | null): boolean =>
  !!a && ASPECTS.some((m) => a[m.key] > 0);

/** Среднее по заполненным аспектам (0, если ничего нет) */
export function aspectsAverage(a: Aspects): number {
  const vals = ASPECTS.map((m) => a[m.key]).filter((v) => v > 0);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

/** Колонки для сохранения в базе: 0 → null */
export function aspectColumns(a: Aspects): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  ASPECTS.forEach((m) => {
    out[m.column] = a[m.key] > 0 ? a[m.key] : null;
  });
  return out;
}

export interface TasteSummary {
  gamesCount: number;
  averages: Record<AspectKey, number>; // 0, если нет данных
  counts: Record<AspectKey, number>;
  archetype: { title: string; hint: string } | null;
}

export function summarizeTaste(list: Aspects[]): TasteSummary {
  const sums = emptyAspects();
  const counts = emptyAspects();
  let gamesCount = 0;
  list.forEach((a) => {
    if (!hasAspects(a)) return;
    gamesCount++;
    ASPECTS.forEach((m) => {
      if (a[m.key] > 0) {
        sums[m.key] += a[m.key];
        counts[m.key] += 1;
      }
    });
  });
  const averages = emptyAspects();
  ASPECTS.forEach((m) => {
    averages[m.key] = counts[m.key] ? Math.round((sums[m.key] / counts[m.key]) * 10) / 10 : 0;
  });

  let archetype: TasteSummary['archetype'] = null;
  const rated = ASPECTS.filter((m) => counts[m.key] > 0).sort((a, b) => averages[b.key] - averages[a.key]);
  if (rated.length >= 2) {
    const [top, second] = rated;
    if (averages[top.key] - averages[second.key] < 0.4) {
      archetype = { title: 'Универсал', hint: 'Ты ценишь игру целиком — сильных перекосов нет' };
    } else {
      archetype = { title: top.archetype, hint: top.archetypeHint };
    }
  } else if (rated.length === 1) {
    archetype = { title: rated[0].archetype, hint: rated[0].archetypeHint };
  }
  return { gamesCount, averages, counts, archetype };
}
