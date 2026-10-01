import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Проверяем, есть ли уже кириллица — если да, перевод не нужен
    if (/[а-яА-ЯёЁ]/.test(text)) {
      return NextResponse.json({ translatedText: text });
    }

    // Google Translate через неофициальный API (быстро, бесплатно, без лимитов)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // Google возвращает массив массивов: [[[translated, source, ...], ...], ...]
    const translatedText = data[0].map((item: any[]) => item[0]).join('');

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
  }
}