// Общие константы для всех IGDB-роутов

// RAWG-slug → IGDB genre IDs (фронт использует slug'и). Круглые скобки = «любой из жанров».
// Жанры IGDB: 4 Fighting, 5 Shooter, 8 Platform, 9 Puzzle, 10 Racing, 11 RTS, 12 RPG, 13 Simulator,
// 14 Sport, 15 Strategy, 16 Turn-based, 24 Tactical, 25 Hack and slash, 31 Adventure, 32 Indie
export const GENRE_MAP: Record<string, string> = {
  action: '(4,5,8,25)',
  adventure: '(31)',
  'role-playing-games-rpg': '(12)',
  strategy: '(11,15,16,24)',
  shooter: '(5)',
  puzzle: '(9)',
  racing: '(10)',
  sports: '(14)',
  simulation: '(13)',
  indie: '(32)',
};

// Поля, которые нужны mapIgdbGame (один запрос — все данные карточки)
export const IGDB_GAME_FIELDS = `fields name, game_type, version_parent, rating, rating_count,
  aggregated_rating, aggregated_rating_count,
  total_rating, total_rating_count, first_release_date, hypes,
  cover.image_id, artworks.image_id, screenshots.image_id,
  genres.name, themes.name, platforms.name, summary, storyline, videos.video_id,
  external_games.uid, external_games.external_game_source;`;

const EDITION_PATTERNS = [
  /\b(Collector'?s|Premium|Deluxe|Ultimate|Definitive|Gold|Complete|Enhanced|Special|Limited|Diamond|Legendary|Royal|Imperial)\s+Edition\b/i,
  /\bGame of the Year\b/i,
  /\bGOTY\b/i,
  /\bRemaster(ed)?\b/i,
  /\bRemake\b/i,
];

export function isEdition(name: string): boolean {
  return EDITION_PATTERNS.some((re) => re.test(name));
}
