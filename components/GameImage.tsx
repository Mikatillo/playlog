'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';

type GameImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  /** Запасная картинка, если основная не загрузилась (например, у Steam нет header.jpg) */
  fallback?: string;
  /**
   * Умная подгонка под контейнер 16:9: если пропорции картинки близки к 16:9 — заполняем карточку,
   * иначе (квадрат, вертикальный постер) — вписываем целиком, а фон заливаем её же размытой копией.
   */
  smart?: boolean;
};

/** next/image, который при ошибке подставляет запасную обложку и (по желанию) не обрезает картинку. */
export default function GameImage({ src, fallback, smart = false, onError, onLoad, className, ...rest }: GameImageProps) {
  const [failed, setFailed] = useState(false);
  const [contain, setContain] = useState(false);

  useEffect(() => {
    setFailed(false);
    setContain(false);
  }, [src]);

  const useFallback = failed && !!fallback;
  const current = useFallback ? (fallback as string) : src;

  const handleLoad: ImageProps['onLoad'] = (e) => {
    if (smart) {
      const img = e.currentTarget as HTMLImageElement;
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        // 16:9 ≈ 1.78. Всё, что заметно уже или шире (квадрат, постер, панорама), вписываем целиком
        setContain(ratio < 1.5 || ratio > 2.3);
      }
    }
    onLoad?.(e);
  };

  const handleError: ImageProps['onError'] = (e) => {
    if (!failed && fallback) setFailed(true);
    onError?.(e);
  };

  const mainClass = contain ? (className || '').replace('object-cover', 'object-contain') : className;

  return (
    <>
      {smart && contain && (
        <Image
          {...rest}
          src={current}
          alt=""
          aria-hidden="true"
          className="object-cover scale-125 blur-2xl opacity-50 pointer-events-none"
          priority={false}
          loading="lazy"
        />
      )}
      <Image {...rest} src={current} className={mainClass} onLoad={handleLoad} onError={handleError} />
    </>
  );
}
