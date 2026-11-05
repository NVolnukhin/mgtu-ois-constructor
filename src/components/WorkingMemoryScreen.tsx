import { useEffect, useMemo, useRef } from 'react';
import { preferencePercent, useBase } from '../base.ts';
import { buildProfile, infer, rankObjects, ruleTitle, selectedOptions } from '../engine/scoring.ts';
import type { Answers } from '../engine/types.ts';
import { plural } from '../plural.ts';
import { useConfirm } from './ConfirmDialog.tsx';
import { RankingList } from './RankingList.tsx';

interface WorkingMemoryScreenProps {
  answers: Answers;
  returnPath: string;
  onReset: () => void;
}

/** Просмотр рабочей базы данных: факты текущего сеанса и то, что из них вывела система. */
export function WorkingMemoryScreen({ answers, returnPath, onReset }: WorkingMemoryScreenProps) {
  const confirm = useConfirm();
  const { base, steps, attributeRuleOf } = useBase();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { effective, inferred, profile, ranking, filled } = useMemo(() => {
    const inference = infer(base, answers);
    const profile = buildProfile(base, inference.answers);
    return {
      effective: inference.answers,
      inferred: inference.inferred,
      profile,
      ranking: rankObjects(base, profile.preference),
      filled: steps.filter(({ question }) => selectedOptions(question, inference.answers).length > 0).length,
    };
  }, [base, steps, answers]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const empty = Object.keys(answers).length === 0;

  async function reset() {
    if (empty) return;
    const yes = await confirm({ title: 'Очистить рабочую базу данных?', message: 'Все ответы будут удалены.', action: 'Очистить' });
    if (yes) onReset();
  }

  return (
    <article className="wm">
      <h1 ref={titleRef} tabIndex={-1} className="page__title">
        Рабочая база данных
      </h1>
      <p className="page__lead">
        Факты текущего сеанса: параметры, полученные от пользователя и выведенные правилами «параметр + параметр»,
        сработавшие правила «параметр + атрибут» и профиль предпочтений, который из них получается. Хранятся в браузере
        (localStorage), у каждой базы свои. Сейчас известно {filled} из {plural(steps.length, ['параметра', 'параметров', 'параметров'])}.
      </p>

      <section className="section">
        <h2 className="section__title">Параметры пользователя</h2>
        <div className="table-scroll">
          <table className="kb-table kb-table--wide">
            <thead>
              <tr>
                <th scope="col">№</th>
                <th scope="col">Параметр</th>
                <th scope="col">Значение</th>
                <th scope="col">Источник</th>
                <th scope="col">Сработали правила</th>
              </tr>
            </thead>
            <tbody>
              {steps.map(({ question, index }) => {
                const chosen = selectedOptions(question, effective);
                const rule = inferred.get(question.id);
                return (
                  <tr key={question.id} className={chosen.length === 0 ? 'wm__empty' : undefined}>
                    <td>{index + 1}</td>
                    <th scope="row" className="kb-table__name">
                      {question.parameter}
                    </th>
                    <td>{chosen.length > 0 ? chosen.map((option) => option.text).join('; ') : '—'}</td>
                    <td className="wm__source">{rule ? `Правило ${ruleTitle(rule)}` : chosen.length > 0 ? 'Ответ пользователя' : 'Ещё не получен'}</td>
                    <td className="wm__source">
                      {chosen.flatMap((option) => attributeRuleOf(question.id, option.id)?.title ?? []).join(', ') || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Профиль предпочтений</h2>
        <p className="section__lead">
          Сумма баллов по атрибуту и где она лежит между наименьшей и наибольшей возможной: 0&nbsp;% — все ответы против
          атрибута, 50&nbsp;% — поровну, 100&nbsp;% — все за.
        </p>
        <div className="table-scroll">
          <table className="kb-table kb-table--wide profile">
            <thead>
              <tr>
                <th scope="col">Атрибут</th>
                <th scope="col">Баллы</th>
                <th scope="col">Возможно</th>
                <th scope="col" className="profile__bar-col">
                  Предпочтение
                </th>
              </tr>
            </thead>
            <tbody>
              {base.attributes.map((attribute) => {
                const value = profile.preference[attribute.id];
                const span = profile.high[attribute.id] - profile.low[attribute.id];
                return (
                  <tr key={attribute.id}>
                    <th scope="row" className="kb-table__name">
                      {attribute.title}
                    </th>
                    <td>{format(profile.points[attribute.id])}</td>
                    <td>{span > 0 ? `от ${format(profile.low[attribute.id])} до ${format(profile.high[attribute.id])}` : '—'}</td>
                    <td className="profile__bar-col">
                      <span className="diverging" aria-hidden="true">
                        <span
                          className={value < 0 ? 'diverging__fill diverging__fill--minus' : 'diverging__fill'}
                          style={{ width: `${Math.abs(value) * 50}%`, [value < 0 ? 'right' : 'left']: '50%' }}
                        />
                      </span>
                      <span className="profile__value">{span > 0 ? preferencePercent(value) : 'нет данных'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Рейтинг по текущим фактам</h2>
        {filled > 0 ? <RankingList items={ranking} /> : <p className="section__lead">Пока нет ни одного параметра.</p>}
      </section>

      <div className="actions">
        <a className="btn btn--secondary" href={returnPath}>
          Вернуться
        </a>
        {/* Неактивная кнопка остаётся в обходе с клавиатуры: иначе после очистки фокус потерялся бы. */}
        <button type="button" className="btn btn--ghost" onClick={reset} aria-disabled={empty}>
          Очистить рабочую базу данных
        </button>
      </div>
    </article>
  );
}

function format(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : String(value);
}
