// Строит карту «старый id игры (RAWG) → новый id (IGDB)».
//
// Запуск (из папки проекта, нужен Node 18+):
//   node scripts/build-game-map.mjs old-ids.csv
//
// old-ids.csv — выгрузка из Supabase (блок 2 в supabase/migrate_rawg_to_igdb.sql): колонки old_id,title
// Ключи читаются из .env.local: IGDB_CLIENT_ID, IGDB_CLIENT_SECRET (обязательно), RAWG_API_KEY (желательно).
// RAWG нужен, чтобы узнать название и Steam-ссылку по старому id. Без него сопоставятся только игры,
// у которых название сохранено в отзывах/ленте (колонка title).
//
// Результат (рядом со скриптом запуска, в текущей папке):
//   game_id_map.sql  — INSERT'ы для таблицы game_id_map (вставить в Supabase SQL Editor)
//   game_id_map.csv  — для проверки глазами (метод сопоставления, названия)
//   unresolved.csv   — что не удалось сопоставить

import fs from 'node:fs';

// ---------- env ----------
function loadEnv() {
  try {
    for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
}
loadEnv();
const { IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, RAWG_API_KEY } = process.env;
if (!IGDB_CLIENT_ID || !IGDB_CLIENT_SECRET) {
  console.error('Нет IGDB_CLIENT_ID / IGDB_CLIENT_SECRET в .env.local');
  process.exit(1);
}
const input = process.argv[2];
if (!input) {
  console.error('Использование: node scripts/build-game-map.mjs old-ids.csv');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CSV ----------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// ---------- IGDB ----------
let token = null;
async function igdb(endpoint, body) {
  if (!token) {
    const r = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: IGDB_CLIENT_ID, client_secret: IGDB_CLIENT_SECRET, grant_type: 'client_credentials' }),
    });
    if (!r.ok) throw new Error('IGDB auth: ' + r.status + ' ' + (await r.text()));
    token = (await r.json()).access_token;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(300); // лимит IGDB — 4 запроса в секунду
    const r = await fetch('https://api.igdb.com/v4/' + endpoint, {
      method: 'POST',
      headers: { 'Client-ID': IGDB_CLIENT_ID, Authorization: 'Bearer ' + token, 'Content-Type': 'text/plain' },
      body,
    });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await sleep(1000 * (attempt + 1)); continue; }
    throw new Error('IGDB ' + endpoint + ': ' + r.status + ' ' + (await r.text()));
  }
  throw new Error('IGDB: слишком много неудачных попыток');
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/™|®/g, '')
    .replace(/&/g, 'and')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9а-яё]/g, '');

// ---------- чтение входа ----------
const raw = parseCsv(fs.readFileSync(input, 'utf8')).filter((r) => r.length >= 1 && /^\d+$/.test((r[0] || '').trim()));
const items = raw.map((r) => ({ oldId: Number(r[0]), title: (r[1] || '').trim() }));
console.log(`Старых id: ${items.length}`);

// ---------- 1. RAWG: название, год, Steam appid ----------
let rawgDead = !RAWG_API_KEY;
if (rawgDead) console.log('RAWG_API_KEY не задан — используем только названия из CSV.');
let rawgOk = 0;
for (let i = 0; i < items.length && !rawgDead; i++) {
  const it = items[i];
  try {
    const r = await fetch(`https://api.rawg.io/api/games/${it.oldId}?key=${RAWG_API_KEY}`);
    if (r.status === 401 || r.status === 429) {
      console.log(`RAWG отказал (${r.status}) — ключ недействителен или лимит исчерпан. Дальше без RAWG.`);
      rawgDead = true;
      break;
    }
    if (r.ok) {
      const d = await r.json();
      it.rawgName = d.name;
      it.year = Number(String(d.released || '').slice(0, 4)) || 0;
      const steam = (d.stores || []).find((s) => s.store?.id === 1);
      const m = steam?.url?.match(/\/app\/(\d+)/);
      if (m) it.appid = m[1];
      rawgOk++;
    }
  } catch {}
  if ((i + 1) % 25 === 0) console.log(`RAWG: ${i + 1}/${items.length}`);
  await sleep(120);
}
console.log(`RAWG ответил по ${rawgOk} играм`);

// ---------- 2. Steam appid → IGDB ----------
const byApp = items.filter((i) => i.appid);
for (let i = 0; i < byApp.length; i += 100) {
  const chunk = byApp.slice(i, i + 100);
  const uids = chunk.map((c) => `"${c.appid}"`).join(',');
  const ext = await igdb('external_games', `fields game, uid; where external_game_source = 1 & uid = (${uids}); limit 500;`);
  const map = new Map(ext.filter((e) => e.game).map((e) => [e.uid, e.game]));
  chunk.forEach((c) => {
    if (map.has(c.appid)) { c.newId = map.get(c.appid); c.method = 'steam'; }
  });
}

// ---------- 3. Остальные — по названию ----------
const rest = items.filter((i) => !i.newId && (i.rawgName || i.title));
let n = 0;
for (const it of rest) {
  n++;
  const name = (it.rawgName || it.title).replace(/"/g, ' ').replace(/\\/g, ' ').trim();
  if (!name) continue;
  try {
    const found = await igdb(
      'games',
      `search "${name.slice(0, 80)}"; fields name, first_release_date, total_rating_count, game_type; where game_type = 0 & version_parent = null; limit 10;`,
    );
    const target = norm(name);
    const withYear = found.map((g) => ({
      ...g,
      y: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : 0,
    }));
    const yearOk = (g) => !it.year || !g.y || Math.abs(g.y - it.year) <= 1;
    const best = (list) => list.sort((a, b) => (b.total_rating_count || 0) - (a.total_rating_count || 0))[0];

    let hit = best(withYear.filter((g) => norm(g.name) === target && yearOk(g)));
    let method = 'name-exact';
    if (!hit) {
      // нестрогое совпадение: одно название начинается с другого (подзаголовки), год обязан совпасть
      hit = best(
        withYear.filter((g) => {
          const k = norm(g.name);
          const [s, l] = k.length < target.length ? [k, target] : [target, k];
          return s.length >= 6 && l.startsWith(s) && s.length / l.length >= 0.6 && !!it.year && yearOk(g) && g.y > 0;
        }),
      );
      method = 'name-fuzzy';
    }
    if (hit) { it.newId = hit.id; it.method = method; it.igdbName = hit.name; }
  } catch (e) {
    console.log('IGDB поиск не удался для', name, String(e).slice(0, 100));
  }
  if (n % 20 === 0) console.log(`Поиск по названию: ${n}/${rest.length}`);
}

// ---------- 4. Результат ----------
const mapped = items.filter((i) => i.newId);
const unresolved = items.filter((i) => !i.newId);

// Защита: разные старые id → один новый допустимы (дубли в RAWG), но показываем в отчёте
const sqlRows = mapped.map((i) => `(${i.oldId}, ${i.newId}, '${i.method}', '${String(i.rawgName || i.title || '').replace(/'/g, "''")}')`);
let sql = '-- Карта старых id (RAWG) → новых (IGDB). Вставь в Supabase SQL Editor блоком.\n';
for (let i = 0; i < sqlRows.length; i += 200) {
  sql += `insert into game_id_map (old_id, new_id, method, title) values\n${sqlRows.slice(i, i + 200).join(',\n')}\non conflict (old_id) do update set new_id = excluded.new_id, method = excluded.method, title = excluded.title;\n\n`;
}
fs.writeFileSync('game_id_map.sql', sql);
fs.writeFileSync(
  'game_id_map.csv',
  'old_id,new_id,method,rawg_or_saved_title,igdb_name\n' +
    mapped.map((i) => [i.oldId, i.newId, i.method, csvCell(i.rawgName || i.title), csvCell(i.igdbName || '')].join(',')).join('\n'),
);
fs.writeFileSync(
  'unresolved.csv',
  'old_id,title\n' + unresolved.map((i) => [i.oldId, csvCell(i.rawgName || i.title)].join(',')).join('\n'),
);

const by = (m) => mapped.filter((i) => i.method === m).length;
console.log('\nГотово.');
console.log(`  сопоставлено: ${mapped.length} (по Steam: ${by('steam')}, по названию: ${by('name-exact')}, нестрого: ${by('name-fuzzy')})`);
console.log(`  не сопоставлено: ${unresolved.length}`);
console.log('Файлы: game_id_map.sql, game_id_map.csv, unresolved.csv');
console.log('Проверь game_id_map.csv — особенно строки name-fuzzy.');
