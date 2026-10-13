/**
 * Уменьшенная копия картинки для превью в списках (клиентский код, без серверных зависимостей).
 * IGDB: подменяем размер в пути (t_1080p → t_screenshot_med). Остальные источники (Steam) — как есть.
 */
export function thumbUrl(url: string | null | undefined, size = 't_screenshot_med'): string {
  if (!url) return '';
  if (url.includes('images.igdb.com/igdb/image/upload/')) {
    return url.replace(/\/upload\/t_[a-z0-9_]+\//, `/upload/${size}/`);
  }
  return url;
}
