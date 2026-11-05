// Ход теста: на каком вопросе пользователь и что он ответил. Ответы — это рабочая база данных экспертной
// системы; у каждой базы она своя и хранится в браузере, чтобы после перезагрузки можно было продолжить.

import { useEffect, useMemo, useReducer } from 'react';
import type { CompiledBase } from './base.ts';
import { resumeStep, selectedOptions, toggleOption } from './engine/scoring.ts';
import type { Answers } from './engine/types.ts';
import { clearSession, loadSession, onSessionChange, saveSession } from './storage.ts';
import type { StoredSession } from './storage.ts';

export interface QuizState {
  /** Индекс текущего вопроса среди всех вопросов базы знаний. */
  step: number;
  answers: Answers;
}

export type QuizAction =
  | { type: 'reset' }
  | { type: 'toggle'; optionId: string }
  | { type: 'goto'; step: number }
  /** Ответы изменила другая вкладка: ход теста у базы один. */
  | { type: 'sync'; session: StoredSession | null };

const INITIAL: QuizState = { step: 0, answers: {} };

/** Оставляет только ответы на существующие вопросы и варианты; в вопросе с одним ответом — один. */
function currentAnswers(compiled: CompiledBase, saved: Answers): Answers {
  const answers: Answers = {};
  for (const { question } of compiled.steps) {
    const selected = selectedOptions(question, saved).map((option) => option.id);
    if (selected.length > 0) answers[question.id] = question.type === 'single' ? selected.slice(0, 1) : selected;
  }
  return answers;
}

/** База могла измениться с прошлого раза, поэтому сохранённые ответы и номер вопроса приводим к допустимым. */
function load(compiled: CompiledBase): QuizState {
  const saved = loadSession(compiled.id);
  if (!saved) return INITIAL;
  const answers = currentAnswers(compiled, saved.answers);
  return { step: resumeStep(compiled.base, answers, saved.step), answers };
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
          case 'sync': {
            const answers = currentAnswers(compiled, action.session?.answers ?? {});
            // Ответы те же: состояние не меняем, иначе две вкладки записывали бы свой номер вопроса друг за другом бесконечно.
            if (JSON.stringify(answers) === JSON.stringify(currentAnswers(compiled, state.answers))) return state;
            return { step: resumeStep(compiled.base, answers, action.session?.step ?? 0), answers };
          }
        }
      },
    [compiled],
  );
  const [state, dispatch] = useReducer(reducer, compiled, load);

  useEffect(() => {
    if (state.step === 0 && Object.keys(state.answers).length === 0) clearSession(compiled.id);
    else saveSession(compiled.id, state);
  }, [state, compiled.id]);

  useEffect(
    () => onSessionChange(compiled.id, () => dispatch({ type: 'sync', session: loadSession(compiled.id) })),
    [compiled.id],
  );

  return [state, dispatch] as const;
}
