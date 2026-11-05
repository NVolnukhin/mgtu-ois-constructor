import { useEffect, useRef } from 'react';
import { baseImages, isSafeLinkUrl } from '../engine/images.ts';
import { quiz } from '../data.ts';

interface CreditsScreenProps {
  onClose: () => void;
}

export function CreditsScreen({ onClose }: CreditsScreenProps) {
  const seen = new Set<string>();
  const images = baseImages(quiz)
    .map(({ image }) => image)
    .filter((image) => image.credit && !seen.has(image.url) && seen.add(image.url));

  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article className="credits">
      <h1 ref={titleRef} tabIndex={-1} className="credits__title">
        Фотографии
      </h1>
      {quiz.imagesNote && <p className="credits__lead">{quiz.imagesNote}</p>}
      <ul className="credits__list">
        {images.map(({ url, alt, credit }) => (
          <li key={url} className="credit">
            <img className="credit__thumb" src={url} alt="" width={96} height={64} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            <div className="credit__text">
              {alt && <p className="credit__alt">{alt}</p>}
              <p className="credit__meta">
                {[
                  credit?.author,
                  <ExternalLink key="license" url={credit?.licenseUrl} text={credit?.license} />,
                  <ExternalLink key="source" url={credit?.url} text={credit?.source ?? credit?.title} />,
                ]
                  .filter(Boolean)
                  .map((part, index) => (
                    <span key={index}>
                      {index > 0 && ' · '}
                      {part}
                    </span>
                  ))}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="actions">
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Вернуться
        </button>
      </div>
    </article>
  );
}

/** Ссылка, если у неё безопасный адрес; иначе просто текст. */
function ExternalLink({ url, text }: { url?: string; text?: string }) {
  if (!url || !isSafeLinkUrl(url)) return <>{text}</>;
  return (
    <a href={url} target="_blank" rel="noreferrer">
      {text ?? url}
    </a>
  );
}
