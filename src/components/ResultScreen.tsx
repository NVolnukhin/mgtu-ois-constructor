import { useEffect, useMemo, useRef } from 'react';
import { groupsTitle, percent, preferencePercent, useBase } from '../base.ts';
import { addProfile } from '../editor/ops.ts';
import { askedQuestions, attributeLabel, breakdown } from '../engine/scoring.ts';
import type { Evaluation, ObjectScore } from '../engine/scoring.ts';
import type { Answers } from '../engine/types.ts';
import { basePath, navigate } from '../router.ts';
import { updateBase } from '../storage.ts';
import { Photo } from './Photo.tsx';
import { RankingList } from './RankingList.tsx';

interface ResultScreenProps {
  evaluation: Evaluation;
  answers: Answers;
  onRestart: () => void;
}

export function ResultScreen({ evaluation, answers, onRestart }: ResultScreenProps) {
  const compiled = useBase();
  const { id, base, builtIn, attributeById, attributeRuleOf } = compiled;
  const { verdict, objects } = evaluation;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rows = useMemo(() => breakdown(base, answers), [base, answers]);
  const winnerGroup = verdict?.winner.group;
  const leader = objects[0];
  const heroImage = winnerGroup ? winnerGroup.image : base.image;

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  /** Сохраняет эти ответы как тестовый профиль: сегодняшний результат становится ожиданием на будущее. */
  function saveAsProfile() {
    const asked = askedQuestions(base, answers);
    updateBase(id, (draft) =>
      void addProfile(draft, {
        answers: Object.fromEntries(asked.map((question) => [question.id, answers[question.id] ?? []])),
        expectTop: [leader.object.id],
        ...(verdict && { expectGroup: [verdict.winner.group.id], expectClose: verdict.isClose, expectWeak: verdict.isWeak }),
      }),
    );
    navigate(basePath(id, 'checks'));
  }

  return (
    <article className="result">
      <header className={heroImage?.url ? 'result__hero' : 'result__hero result__hero--solo'}>
        <div className="result__intro">
          <p className="eyebrow">{base.settings.resultTitle || (verdict ? 'Результат' : 'Лучше всего подходит')}</p>
          <h1 ref={titleRef} tabIndex={-1} className="result__title">
            {winnerGroup ? winnerGroup.title : leader.object.title}
          </h1>
          {winnerGroup ? (
            winnerGroup.tagline && <p className="result__tagline">{winnerGroup.tagline}</p>
          ) : (
            leader.object.description && <p className="result__tagline">{leader.object.description}</p>
          )}

          <div className="score">
            <p className="score__value">
              {Math.round(verdict ? verdict.winner.percent : leader.score * 100)}
              <span className="score__unit">%</span>
            </p>
            <p className="score__caption">
              {verdict ? `совпадение — ${verdict.winner.points} из ${verdict.winner.max} возможных баллов` : 'совпадение с профилем предпочтений'}
            </p>
          </div>

          {verdict?.isWeak && (
            <p className="callout">
              Результат пока выражен слабо: даже лучшая группа набрала меньше {base.settings.weakPercent} % баллов.
            </p>
          )}
          {verdict?.isClose && verdict.runnerUp && (
            <p className="callout">
              Почти так же подходит «{verdict.runnerUp.group.title}» — {Math.round(verdict.runnerUp.percent)} %.
            </p>
          )}
        </div>
        <Photo image={heroImage} className="result__photo" eager />
      </header>

      <section className="section">
        <h2 className="section__title">Лучше всего подходят</h2>
        {leader.score < 0.5 && (
          <p className="section__lead">Ни одна позиция рейтинга не набрала и 50 % совпадения: это лучшие из имеющихся.</p>
        )}
        <ol className="top-cards">
          {objects.slice(0, 3).map((item) => (
            <TopCard key={item.object.id} item={item} />
          ))}
        </ol>
      </section>

      <div className="result__body">
        <div className="result__main">
          {verdict && verdict.reasons.length > 0 && (
            <section className="section">
              <h2 className="section__title">Почему такой результат</h2>
              <ul className="reasons">
                {verdict.reasons.map((reason) => (
                  <li key={`${reason.questionId}:${reason.text}`}>{reason.text}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="section">
            <h2 className="section__title">Весь рейтинг</h2>
            <p className="section__lead">
              Совпадение — это сходство профиля предпочтений с профилем объекта: 100 % — объект в точности соответствует ответам,
              50 % — никак с ними не связан, ниже 50 % — скорее им противоречит.
            </p>
            <RankingList items={objects} />
          </section>

          {winnerGroup?.description && (
            <section className="section">
              <h2 className="section__title">{winnerGroup.title}</h2>
              <p className="result__text">{winnerGroup.description}</p>
              {winnerGroup.qualities && winnerGroup.qualities.length > 0 && (
                <>
                  <h3 className="result__subtitle">Что пригодится</h3>
                  <ul className="chips">
                    {winnerGroup.qualities.map((quality) => (
                      <li key={quality}>{quality}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {winnerGroup?.firstSteps && winnerGroup.firstSteps.length > 0 && (
            <section className="section">
              <h2 className="section__title">С чего начать</h2>
              <ol className="steps">
                {winnerGroup.firstSteps.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="result__aside">
          <section className="section panel">
            {verdict && (
              <>
                <h2 className="section__title">{groupsTitle(base)}</h2>
                <ul className="bars">
                  {verdict.ranking.map((score) => (
                    <li key={score.group.id} className={score === verdict.winner ? 'bar bar--winner' : 'bar'}>
                      <span className="bar__label">{score.group.title}</span>
                      <span className="bar__track" aria-hidden="true">
                        <span className="bar__fill" style={{ width: `${Math.max(0, score.percent)}%` }} />
                      </span>
                      <span className="bar__value">{Math.round(score.percent)} %</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <details className={verdict ? 'details' : 'details details--first'}>
              <summary className="details__summary">Как считается результат</summary>
              <div className="details__text">
                <p>
                  Каждый ответ срабатывает как правило «параметр + атрибут» и даёт «преимущество» атрибутам. Из сумм получается
                  профиль предпочтений: по каждому из {base.attributes.length} атрибутов — где сумма лежит между наименьшей и
                  наибольшей возможной, от 0 до 100 %.
                </p>
                <p>
                  Профиль сравнивается с атрибутами каждого из {base.objects.length} объектов (косинусная мера сходства с учётом
                  важности атрибутов) и переводится в совпадение от 0 до 100 %: 50 % — объект не связан с ответами. Так получается
                  рейтинг.
                  {verdict && ` Итог — это группа, атрибут которой набрал самую большую долю от возможных баллов.`}
                </p>
              </div>
              <a className="text-button" href={basePath(id, 'wm')}>
                Открыть рабочую базу данных
              </a>
              <ol className="breakdown">
                {rows.map(({ question, selected, points, rule }, i) => {
                  const gained = base.attributes.filter((attribute) => points[attribute.id] !== 0);
                  const fired = selected.flatMap((option) => attributeRuleOf(question.id, option.id)?.title ?? []);
                  return (
                    <li key={question.id} className="breakdown__item">
                      <p className="breakdown__question">
                        {i + 1}. {question.parameter}
                        {rule && <span className="breakdown__rule"> · выведено правилом {rule.title}</span>}
                        {fired.length > 0 && (
                          <span className="breakdown__rule">
                            {' '}
                            · {fired.length === 1 ? 'правило' : 'правила'} {fired.join(', ')}
                          </span>
                        )}
                      </p>
                      <p className="breakdown__answer">{selected.map((option) => option.text).join('; ')}</p>
                      <p className="breakdown__points">
                        {gained.length > 0
                          ? gained.map((attribute) => (
                              <span
                                key={attribute.id}
                                className={
                                  attribute.id === winnerGroup?.attribute
                                    ? 'point point--winner'
                                    : points[attribute.id] < 0
                                      ? 'point point--minus'
                                      : 'point'
                                }
                              >
                                {attributeLabel(attributeById[attribute.id])} {points[attribute.id] > 0 ? '+' : '−'}
                                {Math.abs(points[attribute.id])}
                              </span>
                            ))
                          : 'Баллов не даёт'}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </details>
          </section>
        </aside>
      </div>

      <div className="actions actions--center">
        <button type="button" className="btn btn--secondary" onClick={onRestart}>
          Пройти заново
        </button>
        {!builtIn && (
          <button type="button" className="btn btn--ghost" onClick={saveAsProfile}>
            Сохранить как тестовый профиль
          </button>
        )}
      </div>
    </article>
  );
}

/** Карточка лидера рейтинга: что совпадает с профилем и что нет. */
function TopCard({ item }: { item: ObjectScore }) {
  const { attributeById, groupById } = useBase();
  const group = item.object.group ? groupById[item.object.group] : undefined;
  const matches = item.contributions.filter((c) => c.value > 0).slice(0, 3);
  const conflicts = item.contributions
    .filter((c) => c.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 2);
  return (
    <li className="top-card">
      <div className="top-card__head">
        <span className="top-card__rank">{item.rank}</span>
        <span className="top-card__score">{percent(item.score)}</span>
      </div>
      <h3 className="top-card__title">{item.object.title}</h3>
      {group && <p className="top-card__direction">{group.title}</p>}
      {item.object.description && <p className="top-card__text">{item.object.description}</p>}
      {matches.length > 0 && (
        <p className="top-card__line">
          <span className="top-card__label">Совпадает:</span>
          {matches.map((c) => (
            <span key={c.attribute} className="point point--plus">
              {attributeLabel(attributeById[c.attribute])} {preferencePercent(c.preference)}
            </span>
          ))}
        </p>
      )}
      {conflicts.length > 0 && (
        <p className="top-card__line">
          <span className="top-card__label">Не совпадает:</span>
          {conflicts.map((c) => (
            <span key={c.attribute} className="point point--minus">
              {attributeLabel(attributeById[c.attribute])} {preferencePercent(c.preference)}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
