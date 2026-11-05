import { Fragment, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useBase } from '../base.ts';
import { baseImages, isSafeImageUrl, isSafeLinkUrl } from '../engine/images.ts';

/** Авторы и лицензии картинок выбранной базы. */
export function CreditsScreen({ returnPath }: { returnPath: string }) {
  const { base } = useBase();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const seen = new Set<string>();
  const images = baseImages(base)
    .map(({ image }) => image)
    .filter((image) => image.credit && !seen.has(image.url) && seen.add(image.url));

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article className="credits">
      <h1 ref={titleRef} tabIndex={-1} className="credits__title">
        Фотографии
      </h1>
      {base.imagesNote && <p className="credits__lead">{base.imagesNote}</p>}
      <ul className="credits__list">
        {images.map(({ url, alt, credit }) => (
          <li key={url} className="credit">
            {isSafeImageUrl(url) && (
              <img className="credit__thumb" src={url} alt="" width={96} height={64} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            )}
            <div className="credit__text">
              {alt && <p className="credit__alt">{alt}</p>}
              <p className="credit__meta">
                {[credit?.author, creditLink(credit?.licenseUrl, credit?.license), creditLink(credit?.url, credit?.source ?? credit?.title)]
                  .filter(Boolean)
                  .map((part, index) => (
                    <Fragment key={index}>
                      {index > 0 && ' · '}
                      {part}
                    </Fragment>
                  ))}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <div className="actions">
        <a className="btn btn--secondary" href={returnPath}>
          Вернуться
        </a>
      </div>
    </article>
  );
}

/** Ссылка, если у неё безопасный адрес; иначе просто текст. */
function creditLink(url: string | undefined, text: string | undefined): ReactNode {
  if (url && isSafeLinkUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        {text || url}
      </a>
    );
  }
  return text;
}
