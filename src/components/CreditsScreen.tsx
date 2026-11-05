import { useEffect, useRef } from 'react';
import { image, images } from '../data.ts';

interface CreditsScreenProps {
  onClose: () => void;
}

export function CreditsScreen({ onClose }: CreditsScreenProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article className="credits">
      <h1 ref={titleRef} tabIndex={-1} className="credits__title">
        Фотографии
      </h1>
      <p className="credits__lead">
        Все фото взяты с Wikimedia Commons и Flickr под свободными лицензиями. Для сайта они обрезаны и уменьшены.
      </p>
      <ul className="credits__list">
        {Object.keys(images).map((key) => {
          const { src, alt, credit } = image(key);
          return (
            <li key={key} className="credit">
              <img className="credit__thumb" src={src} alt="" width={96} height={64} loading="lazy" decoding="async" />
              <div className="credit__text">
                <p className="credit__alt">{alt}</p>
                <p className="credit__meta">
                  {credit.author} ·{' '}
                  {credit.licenseUrl ? (
                    <a href={credit.licenseUrl} target="_blank" rel="noreferrer">
                      {credit.license}
                    </a>
                  ) : (
                    credit.license
                  )}{' '}
                  ·{' '}
                  <a href={credit.url} target="_blank" rel="noreferrer">
                    {credit.source}
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Вернуться
        </button>
      </div>
    </article>
  );
}
