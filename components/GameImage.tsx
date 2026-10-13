'use client';

import { useEffect, useState } from 'react';
import Image, { type ImageProps } from 'next/image';

type GameImageProps = Omit<ImageProps, 'src'> & {
  src: string;
  /** Запасная картинка, если основная не загрузилась (например, у Steam нет header.jpg) */
  fallback?: string;
};

/** next/image, который при ошибке загрузки подставляет запасную обложку. */
export default function GameImage({ src, fallback, onError, ...rest }: GameImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const useFallback = failed && !!fallback;

  return (
    <Image
      {...rest}
      src={useFallback ? (fallback as string) : src}
      onError={(e) => {
        if (!failed && fallback) setFailed(true);
        onError?.(e);
      }}
    />
  );
}
