import { useEffect, useRef, useState } from 'react';
import { isSafeImageUrl } from '../engine/images.ts';
import type { ImageRef } from '../engine/types.ts';

interface PhotoProps {
  /** Картинка из базы. Если её нет, компонент ничего не показывает. */
  image?: ImageRef;
  /** Класс рамки: задаёт пропорции и размер. */
  className?: string;
  /** Картинка видна сразу при загрузке страницы — не откладывать её загрузку. */
  eager?: boolean;
  /** Картинка только украшает соседний текст — экранному диктору её описывать не нужно. */
  decorative?: boolean;
}

/**
 * Фото в рамке с серой подложкой: пока картинка грузится, видна подложка, потом фото плавно проявляется.
 * Если картинка не загрузилась или её адрес недопустим, остаётся заглушка.
 */
export function Photo({ image, className, eager = false, decorative = false }: PhotoProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  // Картинка из кэша может загрузиться раньше, чем сработает onLoad.
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [image?.url]);

  if (!image?.url) return null;

  const frame = className ? `photo ${className}` : 'photo';
  if (failedUrl === image.url || !isSafeImageUrl(image.url)) {
    return (
      <div className={`${frame} photo--missing`} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : image.alt || 'Картинка не загрузилась'}>
        <span className="photo__placeholder" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className={frame}>
      <img
        ref={ref}
        className={loaded ? 'photo__img photo__img--loaded' : 'photo__img'}
        src={image.url}
        alt={decorative ? '' : (image.alt ?? '')}
        width={1200}
        height={800}
        style={{ objectPosition: image.position }}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailedUrl(image.url)}
      />
    </div>
  );
}
