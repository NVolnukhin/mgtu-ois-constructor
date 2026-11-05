import { useEffect, useRef, useState } from 'react';
import { image } from '../data.ts';

interface PhotoProps {
  /** Ключ картинки в content/images.json. */
  name: string;
  /** Класс рамки: задаёт пропорции и размер. */
  className?: string;
  /** Картинка видна сразу при загрузке страницы — не откладывать её загрузку. */
  eager?: boolean;
  /** Картинка только украшает соседний текст — экранному диктору её описывать не нужно. */
  decorative?: boolean;
}

/** Фото в рамке с серой подложкой: пока картинка грузится, видна подложка, потом фото плавно проявляется. */
export function Photo({ name, className, eager = false, decorative = false }: PhotoProps) {
  const { src, alt, position } = image(name);
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // Картинка из кэша может загрузиться раньше, чем сработает onLoad.
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);

  return (
    <div className={className ? `photo ${className}` : 'photo'}>
      <img
        ref={ref}
        className={loaded ? 'photo__img photo__img--loaded' : 'photo__img'}
        src={src}
        alt={decorative ? '' : alt}
        width={1200}
        height={800}
        style={{ objectPosition: position }}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
