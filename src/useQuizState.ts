// Состояние приложения: какой экран открыт, на каком вопросе пользователь и что он ответил.
// Ответы — это рабочая база данных экспертной системы; она хранится в localStorage,
// чтобы после перезагрузки можно было продолжить.

import { useEffect, useReducer } from 'react';
import { infer, isComplete, toggleOption } from './engine/scoring.ts';
import type { Answers } from './engine/types.ts';
import { quiz, steps } from './data.ts';

export type MainScreen = 'start' | 'quiz' | 'result';
/** Экраны поверх основного: авторы фото, база знаний, рабочая база данных. */
export type OverlayScreen = 'credits' | 'kb' | 'wm';
export type Screen = MainScreen | OverlayScreen;

export interface QuizState {
  screen: Screen;
  /** Куда вернуться с экрана поверх основного. */
  returnTo: MainScreen;
  /** Индекс текущего вопроса среди всех вопросов базы знаний. */
  step: number;
  answers: Answers;
}

export type QuizAction =
  | { type: 'start' }
  | { type: 'resume' }
  | { type: 'home' }
  | { type: 'toggle'; optionId: string }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'open'; screen: OverlayScreen }
  | { type: 'close' }
  | { type: 'reset' };

// На github.io все сайты аккаунта делят один origin, а значит и localStorage:
// ключ не должен совпадать с ключом прототипа в репозитории mgtu-ois.
const STORAGE_KEY = 'mgtu-ois-constructor/answers/v1';
const INITIAL: QuizState = { screen: 'start', returnTo: 'start', step: 0, answers: {} };

/** Ближайший вопрос в направлении direction, который задаётся пользователю (не выведен правилом). */
function nearestAsked(from: number, direction: 1 | -1, answers: Answers): number | null {
  const { inferred } = infer(quiz, answers);
  for (let i = from; i >= 0 && i < steps.length; i += direction) {
    if (!inferred.has(steps[i].question.id)) return i;
  }
  return null;
}

function reducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case 'start':
      return { ...INITIAL, screen: 'quiz' };
    case 'resume':
      return { ...state, screen: 'quiz', step: nearestAsked(state.step, 1, state.answers) ?? state.step };
    case 'home':
      return { ...state, screen: 'start' };
    case 'toggle': {
      const { question } = steps[state.step];
      const selected = toggleOption(question, state.answers[question.id] ?? [], action.optionId);
      return { ...state, answers: { ...state.answers, [question.id]: selected } };
    }
    case 'next': {
      const next = nearestAsked(state.step + 1, 1, state.answers);
      return next === null ? { ...state, screen: 'result' } : { ...state, step: next };
    }
    case 'back': {
      const previous = nearestAsked(state.step - 1, -1, state.answers);
      return previous === null ? { ...state, screen: 'start' } : { ...state, step: previous };
    }
    case 'open':
      return state.screen === action.screen
        ? state
        : { ...state, screen: action.screen, returnTo: isMain(state.screen) ? state.screen : state.returnTo };
    case 'close':
      return { ...state, screen: state.returnTo };
    case 'reset':
      return { ...INITIAL, screen: state.screen, returnTo: 'start' };
  }
}

function isMain(screen: Screen): screen is MainScreen {
  return screen === 'start' || screen === 'quiz' || screen === 'result';
}

function load(): QuizState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved.step === 'number' && saved.answers && typeof saved.answers === 'object') {
      const answers: Answers = saved.answers;
      const step = nearestAsked(Math.min(Math.max(0, saved.step), steps.length - 1), 1, answers) ?? 0;
      // Если после обновления базы знаний старые ответы неполные, показывать результат по ним нельзя.
      const screen: MainScreen =
        saved.screen === 'quiz' || (saved.screen === 'result' && isComplete(quiz, answers)) ? saved.screen : 'start';
      return { ...INITIAL, screen, step, answers };
    }
  } catch {
    // Повреждённые данные или недоступное хранилище — просто начинаем сначала.
  }
  return INITIAL;
}

export function useQuizState() {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    const { step, answers } = state;
    const screen = isMain(state.screen) ? state.screen : state.returnTo;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ screen, step, answers }));
    } catch {
      // В приватном режиме хранилище бывает недоступно — тест работает и без сохранения.
    }
  }, [state]);

  return [state, dispatch] as const;
}
