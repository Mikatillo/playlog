import { NextRequest, NextResponse } from 'next/server';

async function translateWithGoogle(text: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return null;
    const raw = await response.text();
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const result = data[0]
      .map((item: any[]) => (Array.isArray(item) ? item[0] : ''))
      .filter(Boolean)
      .join('');
    return result || null;
  } catch {
    return null;
  }
}

async function translateWithMyMemory(text: string): Promise<string | null> {
  try {
    // MyMemory режет запросы длиннее 500 символов — разбиваем на куски
    const chunks: string[] = [];
    const maxLen = 450;
    let remaining = text;
    while (remaining.length > 0) {
      let cut = remaining.length <= maxLen ? remaining.length : remaining.lastIndexOf(' ', maxLen);
      if (cut <= 0) cut = maxLen;
      chunks.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
      if (chunks.length > 20) break; // предохранитель
    }

    const translated: string[] = [];
    for (const chunk of chunks) {
      if (!chunk) continue;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|ru`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const t = data?.responseData?.translatedText;
      if (!t || typeof t !== 'string') return null;
      // MyMemory иногда возвращает ошибки в translatedText
      if (t.includes('MYMEMORY WARNING') || t.includes('INVALID')) return null;
      translated.push(t);
    }
    return translated.join(' ') || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let text = '';
  try {
    const body = await request.json();
    text = body.text;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (/[а-яА-ЯёЁ]/.test(text)) {
      return NextResponse.json({ translatedText: text });
    }

    // 1. Пробуем Google
    let result = await translateWithGoogle(text);

    // 2. Если не вышло — MyMemory
    if (!result) {
      result = await translateWithMyMemory(text);
    }

    // 3. Если оба упали — возвращаем оригинал
    if (!result) {
      return NextResponse.json({ translatedText: text });
    }

    return NextResponse.json({ translatedText: result });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ translatedText: text });
  }
}