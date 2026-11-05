// Ход теста: на каком вопросе пользователь и что он ответил. Ответы — это рабочая база данных экспертной
// системы; у каждой базы она своя и хранится в браузере, чтобы после перезагрузки можно было продолжить.

import { useEffect, useMemo, useReducer } from 'react';
import type { CompiledBase } from './base.ts';
import { infer, toggleOption } from './engine/scoring.ts';
import type { Answers } from './engine/types.ts';
import { clearSession, loadSession, saveSession } from './storage.ts';

export interface QuizState {
  /** Индекс текущего вопроса среди всех вопросов базы знаний. */
  step: number;
  answers: Answers;
}

export type QuizAction =
  | { type: 'reset' }
  | { type: 'toggle'; optionId: string }
  | { type: 'goto'; step: number };

const INITIAL: QuizState = { step: 0, answers: {} };

/** Ближайший вопрос в направлении direction, который задаётся пользователю (не выведен правилом). */
export function nearestAsked(compiled: CompiledBase, from: number, direction: 1 | -1, answers: Answers): number | null {
  const { steps, base } = compiled;
  const { inferred } = infer(base, answers);
  for (let i = from; i >= 0 && i < steps.length; i += direction) {
    if (!inferred.has(steps[i].question.id)) return i;
  }
  return null;
}

/** База могла измениться с прошлого раза, поэтому сохранённый номер вопроса приводим к допустимому. */
function load(compiled: CompiledBase): QuizState {
  const saved = loadSession(compiled.id);
  if (!saved) return INITIAL;
  const last = Math.max(0, compiled.steps.length - 1);
  const step = Math.min(Math.max(0, saved.step), last);
  return { step: nearestAsked(compiled, step, 1, saved.answers) ?? 0, answers: saved.answers };
}

export function useQuizState(compiled: CompiledBase) {
  const reducer = useMemo(
    () =>
      (state: QuizState, action: QuizAction): QuizState => {
        switch (action.type) {
          case 'reset':
            return INITIAL;
          case 'toggle': {
            const { question } = compiled.steps[state.step];
            const selected = toggleOption(question, state.answers[question.id] ?? [], action.optionId);
            return { ...state, answers: { ...state.answers, [question.id]: selected } };
          }
          case 'goto':
            return { ...state, step: action.step };
        }
      },
    [compiled],
  );
  const [state, dispatch] = useReducer(reducer, compiled, load);

  useEffect(() => {
    if (state.step === 0 && Object.keys(state.answers).length === 0) clearSession(compiled.id);
    else saveSession(compiled.id, state);
  }, [state, compiled.id]);

  return [state, dispatch] as const;
}
