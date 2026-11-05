import { useEffect, useMemo, useRef } from 'react';
import { breakdown, SPHERE_WEIGHT } from '../engine/scoring.ts';
import type { Evaluation, ObjectScore } from '../engine/scoring.ts';
import { ATTRIBUTE_IDS } from '../engine/types.ts';
import type { Answers } from '../engine/types.ts';
import { attributeById, attributeRuleOf, directionById, percent, preferencePercent, quiz } from '../data.ts';
import { Photo } from './Photo.tsx';
import { RankingList } from './RankingList.tsx';

interface ResultScreenProps {
  evaluation: Evaluation;
  answers: Answers;
  onRestart: () => void;
  onOpenWorkingMemory: () => void;
}

export function ResultScreen({ evaluation, answers, onRestart, onOpenWorkingMemory }: ResultScreenProps) {
  const { winner, runnerUp, ranking, isClose, isWeak, reasons, objects } = evaluation;
  const { direction } = winner;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rows = useMemo(() => breakdown(quiz, answers), [answers]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <article className="result">
      <header className="result__hero">
        <div className="result__intro">
          <p className="eyebrow">Твоя направленность</p>
          <h1 ref={titleRef} tabIndex={-1} className="result__title">
            {direction.title}
          </h1>
          <p className="result__tagline">{direction.tagline}</p>

          <div className="score">
            <p className="score__value">
              {Math.round(winner.percent)}
              <span className="score__unit">%</span>
            </p>
            <p className="score__caption">
              совпадение со сферой — {winner.points} из {winner.max} возможных баллов
            </p>
          </div>

          {isWeak && (
            <p className="callout">
              Склонность пока выражена слабо: даже самая близкая сфера набрала меньше половины баллов. Попробуй разные
              направления на разовых акциях — так станет понятнее, что откликается именно тебе.
            </p>
          )}
          {isClose && (
            <p className="callout">
              Почти так же тебе подходит направление «{runnerUp.direction.title}» — {Math.round(runnerUp.percent)} %.
              Можно попробовать оба и выбрать по ощущениям.
            </p>
          )}
        </div>
        <Photo name={direction.image} className="result__photo" eager />
      </header>

      <section className="section">
        <h2 className="section__title">Лучше всего тебе подходят</h2>
        {objects[0].score < 0.5 && (
          <p className="section__lead">
            По твоим ответам ни один вид деятельности не набрал и 50 % совпадения — это лучшие из имеющихся. Попробуй
            их на разовых акциях, чтобы понять, что откликается.
          </p>
        )}
        <ol className="top-cards">
          {objects.slice(0, 3).map((item) => (
            <TopCard key={item.object.id} item={item} />
          ))}
        </ol>
      </section>

      <div className="result__body">
        <div className="result__main">
          {reasons.length > 0 && (
            <section className="section">
              <h2 className="section__title">Почему у тебя такая направленность</h2>
              <ul className="reasons">
                {reasons.map((reason) => (
                  <li key={`${reason.questionId}:${reason.text}`}>{reason.text}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="section">
            <h2 className="section__title">Все виды деятельности по рангу</h2>
            <p className="section__lead">
              Совпадение — это сходство твоего профиля предпочтений с профилем деятельности: 100 % — деятельность
              ровно такая, как ты хочешь, 50 % — никак не связана с твоими ответами, ниже 50 % — скорее им противоречит.
            </p>
            <RankingList items={objects} />
          </section>

          <section className="section">
            <h2 className="section__title">О направлении</h2>
            <p className="result__text">{direction.description}</p>
            <h3 className="result__subtitle">Что пригодится</h3>
            <ul className="chips">
              {direction.qualities.map((quality) => (
                <li key={quality}>{quality}</li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2 className="section__title">С чего начать</h2>
            <ol className="steps">
              {direction.firstSteps.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="result__aside">
          <section className="section panel">
            <h2 className="section__title">Все направления</h2>
            <ul className="bars">
              {ranking.map((score) => (
                <li key={score.direction.id} className={score === winner ? 'bar bar--winner' : 'bar'}>
                  <span className="bar__label">{score.direction.title}</span>
                  <span className="bar__track" aria-hidden="true">
                    <span className="bar__fill" style={{ width: `${score.percent}%` }} />
                  </span>
                  <span className="bar__value">{Math.round(score.percent)} %</span>
                </li>
              ))}
            </ul>

            <details className="details">
              <summary className="details__summary">Как считается результат</summary>
              <div className="details__text">
                <p>
                  Каждый ответ срабатывает как правило «параметр + атрибут» и даёт «преимущество» атрибутам: сферам
                  (дети, инклюзия, старшие, экология) и стилю деятельности (нагрузка, регулярность, лидерство и другие). Из
                  сумм получается профиль предпочтений: по
                  каждому из {quiz.attributes.length} атрибутов — где сумма лежит между наименьшей и наибольшей возможной,
                  от 0 до 100 %.
                </p>
                <p>
                  Профиль сравнивается с атрибутами каждого из {quiz.objects.length} видов деятельности (косинусная мера
                  сходства, сферы с весом {SPHERE_WEIGHT}) и переводится в совпадение от 0 до 100 %: 50 % — деятельность
                  не связана с ответами. Так получается рейтинг. Направленность — это сфера, по которой набрано больше
                  всего баллов из {winner.max} возможных.
                </p>
              </div>
              <button type="button" className="text-button" onClick={onOpenWorkingMemory}>
                Открыть рабочую базу данных
              </button>
              <ol className="breakdown">
                {rows.map(({ question, selected, points, rule }, i) => {
                  const gained = ATTRIBUTE_IDS.filter((id) => points[id] !== 0);
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
                          ? gained.map((id) => (
                              <span
                                key={id}
                                className={id === direction.id ? 'point point--winner' : points[id] < 0 ? 'point point--minus' : 'point'}
                              >
                                {attributeById[id].short} {points[id] > 0 ? '+' : '−'}
                                {Math.abs(points[id])}
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
      </div>
    </article>
  );
}

/** Карточка лидера рейтинга: что совпадает с профилем и что нет. */
function TopCard({ item }: { item: ObjectScore }) {
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
      <p className="top-card__direction">{directionById[item.object.direction].title}</p>
      <p className="top-card__text">{item.object.description}</p>
      {matches.length > 0 && (
        <p className="top-card__line">
          <span className="top-card__label">Совпадает:</span>
          {matches.map((c) => (
            <span key={c.attribute} className="point point--plus">
              {attributeById[c.attribute].short} {preferencePercent(c.preference)}
            </span>
          ))}
        </p>
      )}
      {conflicts.length > 0 && (
        <p className="top-card__line">
          <span className="top-card__label">Не совпадает:</span>
          {conflicts.map((c) => (
            <span key={c.attribute} className="point point--minus">
              {attributeById[c.attribute].short} {preferencePercent(c.preference)}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
