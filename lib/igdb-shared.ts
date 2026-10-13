// Общие константы для всех IGDB-роутов

// RAWG-slug → IGDB genre IDs. Квадратные скобки = «любой из жанров»
export const GENRE_MAP: Record<string, string> = {
  action: '[4,5,8,25]', // Fighting, Shooter, Platform, Hack&slash
  adventure: '[31]',
  'role-playing-games-rpg': '[12]',
  strategy: '[15]',
  shooter: '[5]',
  puzzle: '[9]',
  racing: '[10]',
  sports: '[14]',
  simulation: '[13]',
  indie: '[32]',
};

// Поля, которые нужны mapIgdbGame
export const IGDB_GAME_FIELDS = `fields name, game_type, version_parent, rating, rating_count,
  aggregated_rating, aggregated_rating_count,
  total_rating, total_rating_count, first_release_date,
  cover.image_id, artworks.image_id, screenshots.image_id,
  genres.name, platforms.name, summary, videos.video_id,
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
