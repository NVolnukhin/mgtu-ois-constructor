import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useBase } from '../base.ts';
import type { Step } from '../base.ts';
import { isSafeImageUrl } from '../engine/images.ts';
import type { ObjectScore } from '../engine/scoring.ts';
import type { Option, Question, Rule } from '../engine/types.ts';
import { LiveRanking } from './LiveRanking.tsx';
import { Photo } from './Photo.tsx';

export interface SkippedQuestion {
  question: Question;
  rule: Rule;
  option: Option;
}

interface QuestionScreenProps {
  step: Step;
  selected: string[];
  /** Номер вопроса среди задаваемых, с 1. */
  position: number;
  /** Сколько вопросов задаётся с учётом правил. */
  total: number;
  /** Это последний шаг: дальше результат. */
  finishing: boolean;
  /** Первый задаваемый вопрос блока: показать описание блока. */
  blockStart: boolean;
  /** Доля пройденного по каждому блоку, от 0 до 1. */
  progress: number[];
  /** Вопросы перед этим, которые не задавались: их значение вывели правила. */
  skipped: SkippedQuestion[];
  ranking: ObjectScore[];
  /** Рейтинг до ответа на этот вопрос; null — до этого ответов не было. */
  previousRanking: ObjectScore[] | null;
  hasData: boolean;
  onToggle: (optionId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function QuestionScreen(props: QuestionScreenProps) {
  const { base, steps } = useBase();
  const { step, selected, position, total, finishing, blockStart, progress, skipped, ranking, previousRanking, hasData } = props;
  const { question, block, blockIndex, index } = step;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const inputType = question.type === 'single' ? 'radio' : 'checkbox';
  const severalBlocks = base.blocks.length > 1;

  // Новый вопрос: фокус на его текст, чтобы экранный диктор сразу его прочитал,
  // и заранее грузим картинку следующего вопроса.
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    const next = steps[index + 1]?.question.image?.url;
    if (next && isSafeImageUrl(next)) {
      const preload = new Image();
      preload.referrerPolicy = 'no-referrer';
      preload.src = next;
    }
  }, [index, steps]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (selected.length > 0) props.onNext();
  }

  return (
    <form className="question" onSubmit={submit}>
      <div className="question__aside">
        <Photo image={question.image} className="question__photo" eager />
        <LiveRanking ranking={ranking} previous={previousRanking} hasData={hasData} />
      </div>

      <div className="question__content">
        <div className="progress">
          <div className="progress__meta">
            <span>{severalBlocks ? `Блок ${blockIndex + 1} из ${base.blocks.length}${block.title ? ` · ${block.title}` : ''}` : block.title}</span>
            <span>
              {position} / {total}
            </span>
          </div>
          <div
            className="progress__blocks"
            role="progressbar"
            aria-label="Пройдено вопросов"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={position}
          >
            {base.blocks.map((item, i) => (
              <span key={item.id} className="progress__track">
                <span className="progress__fill" style={{ width: `${progress[i] * 100}%` }} />
              </span>
            ))}
          </div>
        </div>

        {blockStart && block.description && <p className="question__block">{block.description}</p>}

        {skipped.map(({ question: skippedQuestion, rule, option }) => (
          <p key={skippedQuestion.id} className="notice">
            <span className="notice__label">Правило {rule.title}</span>
            Вопрос «{skippedQuestion.parameter}» не задаётся: по предыдущим ответам система сама вывела значение «{option.text}».
          </p>
        ))}

        <div className="badges">
          <span className="badge">{question.type === 'single' ? 'Один ответ' : 'Несколько ответов'}</span>
          {question.situational && <span className="badge badge--outline">Ситуационная задача</span>}
        </div>

        <fieldset className="question__fieldset">
          <legend className="question__legend">
            <h1 ref={titleRef} tabIndex={-1} className="question__title">
              {question.text}
            </h1>
          </legend>
          {question.type === 'multiple' && <p className="question__hint">Можно отметить несколько вариантов</p>}

          <div className="options">
            {question.options.map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label key={option.id} className={checked ? 'option option--checked' : 'option'}>
                  <input
                    className="option__input"
                    type={inputType}
                    name={question.id}
                    value={option.id}
                    checked={checked}
                    onChange={() => props.onToggle(option.id)}
                  />
                  <span className={`option__mark option__mark--${inputType}`} aria-hidden="true" />
                  <Photo image={option.image} className="option__thumb" eager decorative />
                  <span className="option__text">{option.text}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="navbar">
        <button type="button" className="btn btn--ghost" onClick={props.onBack}>
          Назад
        </button>
        <button type="submit" className="btn btn--primary navbar__next" disabled={selected.length === 0}>
          {finishing ? 'Узнать результат' : 'Далее'}
        </button>
      </div>
    </form>
  );
}
