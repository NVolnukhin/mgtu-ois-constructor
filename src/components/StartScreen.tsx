import { useEffect, useRef } from 'react';
import { estimatedMinutes, groupsTitle, useBase } from '../base.ts';
import { copyOf } from '../editor/ops.ts';
import { downloadBase } from '../files.ts';
import { plural } from '../plural.ts';
import { basePath, navigate } from '../router.ts';
import { createBase } from '../storage.ts';
import { Photo } from './Photo.tsx';

interface StartScreenProps {
  /** Сколько вопросов уже отвечено в прошлый раз. */
  answered: number;
  /** Все параметры получены, результат уже можно посмотреть. */
  complete: boolean;
  onStart: () => void;
  onResume: () => void;
}

export function StartScreen({ answered, complete, onStart, onResume }: StartScreenProps) {
  const { id, base, steps, issues, canRun, builtIn } = useBase();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const hasProgress = answered > 0;
  const hasGroups = base.groups.length > 0;
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const title = groupsTitle(base);

  const howItWorks = [
    `Всего ${plural(steps.length, ['вопрос', 'вопроса', 'вопросов'])}. В одних можно выбрать один ответ, в других — несколько. Если ответ следует из предыдущих, система выведет его сама и не станет спрашивать.`,
    `Каждый ответ даёт «преимущество» свойствам объектов, и после каждого ответа система пересчитывает рейтинг из ${plural(base.objects.length, ['позиции', 'позиций', 'позиций'])}.`,
    hasGroups
      ? 'В конце будет итог, весь рейтинг и объяснение, почему лидеры подходят.'
      : 'В конце будет весь рейтинг и объяснение, почему лидеры подходят.',
  ];

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="start">
      <section className={base.image?.url ? 'start__hero' : 'start__hero start__hero--solo'}>
        <div className="start__intro">
          {base.subtitle && <p className="eyebrow">{base.subtitle}</p>}
          <h1 ref={titleRef} tabIndex={-1} className="start__title">
            {base.title || 'Без названия'}
          </h1>
          {base.description && <p className="start__lead">{base.description}</p>}
          <ul className="facts" aria-label="Коротко о тесте">
            <li>{plural(steps.length, ['вопрос', 'вопроса', 'вопросов'])}</li>
            <li>≈ {plural(estimatedMinutes(steps.length), ['минута', 'минуты', 'минут'])}</li>
            <li>{plural(base.objects.length, ['позиция', 'позиции', 'позиций'])} в рейтинге</li>
            {hasGroups && (
              <li>
                {title}: {base.groups.length}
              </li>
            )}
          </ul>

          {!canRun && (
            <div className="alert" role="alert">
              <p className="alert__title">Тест пока не запускается</p>
              <p>
                В базе {plural(errors, ['ошибка', 'ошибки', 'ошибок'])}.{' '}
                <a href={basePath(id, 'checks')}>Посмотреть ошибки</a>
                {!builtIn && (
                  <>
                    {' '}
                    или <a href={basePath(id, 'edit')}>открыть редактор</a>
                  </>
                )}
                .
              </p>
            </div>
          )}

          {canRun && (
            <div className="actions">
              {hasProgress ? (
                <>
                  <button type="button" className="btn btn--primary" onClick={onResume}>
                    Продолжить
                  </button>
                  {complete && (
                    <a className="btn btn--secondary" href={basePath(id, 'result')}>
                      Посмотреть результат
                    </a>
                  )}
                  <button type="button" className="btn btn--secondary" onClick={onStart}>
                    Начать заново
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--primary" onClick={onStart}>
                  Начать тест
                </button>
              )}
            </div>
          )}
          {canRun && hasProgress && (
            <p className="start__progress">
              Уже есть ответы на {answered} из {plural(steps.length, ['вопроса', 'вопросов', 'вопросов'])}.
            </p>
          )}
        </div>
        <Photo image={base.image} className="start__photo" eager />
      </section>

      {hasGroups && (
        <section className="section">
          <h2 className="section__title">{title}</h2>
          <ul className="direction-grid">
            {base.groups.map((group) => (
              <li key={group.id} className="direction-card">
                <Photo image={group.image} className="direction-card__photo" />
                <h3 className="direction-card__title">{group.title}</h3>
                {(group.tagline || group.description) && <p className="direction-card__text">{group.tagline || group.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <h2 className="section__title">Как это работает</h2>
        <ol className="how">
          {howItWorks.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
        <p className="note">
          База знаний этой системы открыта:{' '}
          <a className="text-button text-button--inline" href={basePath(id, 'kb')}>
            объекты, атрибуты и правила
          </a>
          .{' '}
          <button type="button" className="text-button text-button--inline" onClick={() => downloadBase(base)}>
            Скачать базу в JSON
          </button>
          {' · '}
          {builtIn ? (
            <button type="button" className="text-button text-button--inline" onClick={() => navigate(basePath(createBase(copyOf(base)), 'edit'))}>
              Сделать копию для редактирования
            </button>
          ) : (
            <a className="text-button text-button--inline" href={basePath(id, 'edit')}>
              Открыть в редакторе
            </a>
          )}
        </p>
      </section>
    </div>
  );
}
