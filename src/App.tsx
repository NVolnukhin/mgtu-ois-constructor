import { useEffect, useMemo, useState } from 'react';
import { askedQuestions, evaluate, infer, liveRanking, selectedOptions } from './engine/scoring.ts';
import { quiz, steps } from './data.ts';
import { useQuizState } from './useQuizState.ts';
import type { OverlayScreen } from './useQuizState.ts';
import { CreditsScreen } from './components/CreditsScreen.tsx';
import { KnowledgeBaseScreen } from './components/KnowledgeBaseScreen.tsx';
import { QuestionScreen } from './components/QuestionScreen.tsx';
import type { SkippedQuestion } from './components/QuestionScreen.tsx';
import { ResultScreen } from './components/ResultScreen.tsx';
import { StartScreen } from './components/StartScreen.tsx';
import { WorkingMemoryScreen } from './components/WorkingMemoryScreen.tsx';

const NAV: { screen: OverlayScreen; title: string }[] = [
  { screen: 'kb', title: 'База знаний' },
  { screen: 'wm', title: 'Рабочая БД' },
];

export function App() {
  const [state, dispatch] = useQuizState();
  const { screen, step, answers } = state;
  const [menuOpen, setMenuOpen] = useState(false);

  const evaluation = useMemo(() => (screen === 'result' ? evaluate(quiz, answers) : null), [screen, answers]);
  const answered = steps.filter(({ question }) => selectedOptions(question, answers).length > 0).length;

  const quizView = useMemo(() => {
    if (screen !== 'quiz') return null;
    const current = steps[step];
    const asked = askedQuestions(quiz, answers);
    const { answers: effective, inferred } = infer(quiz, answers);
    // Рейтинг до ответа на текущий вопрос — чтобы показать, как этот ответ сдвинул места.
    const withoutCurrent = { ...answers };
    delete withoutCurrent[current.question.id];
    // Вопросы между предыдущим заданным и текущим, которые вывели правила.
    const previousAsked = [...asked].reverse().find((q) => steps.find((s) => s.question === q)!.index < step);
    const from = previousAsked ? steps.find((s) => s.question === previousAsked)!.index + 1 : 0;
    const skipped: SkippedQuestion[] = steps.slice(from, step).flatMap(({ question }) => {
      const rule = inferred.get(question.id);
      const option = selectedOptions(question, effective)[0];
      return rule && option ? [{ question, rule, option }] : [];
    });
    const progress = quiz.blocks.map((block, blockIndex) => {
      const inBlock = asked.filter((q) => block.questions.includes(q));
      if (blockIndex < current.blockIndex) return 1;
      if (blockIndex > current.blockIndex || inBlock.length === 0) return 0;
      return (inBlock.indexOf(current.question) + 1) / inBlock.length;
    });
    return {
      current,
      position: asked.indexOf(current.question) + 1,
      total: asked.length,
      skipped,
      progress,
      ranking: liveRanking(quiz, answers),
      // До первого ответа рейтинга ещё не было — сдвигать места не от чего.
      previousRanking: Object.values(infer(quiz, withoutCurrent).answers).some((ids) => ids.length > 0)
        ? liveRanking(quiz, withoutCurrent)
        : null,
      hasData: Object.values(effective).some((ids) => ids.length > 0),
    };
  }, [screen, step, answers]);

  // Сменился экран или вопрос — прокручиваем страницу наверх и закрываем меню.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setMenuOpen(false);
  }, [screen, step]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="brand" onClick={() => dispatch({ type: 'home' })}>
          <img className="brand__icon" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={28} height={28} />
          <span className="brand__name">{quiz.title}</span>
        </button>
        <nav className="topnav" aria-label="Разделы системы">
          <button
            type="button"
            className="topnav__menu"
            aria-expanded={menuOpen}
            aria-controls="topnav-links"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="topnav__menu-icon" aria-hidden="true" />
            <span className="visually-hidden">Меню</span>
          </button>
          <div id="topnav-links" className={menuOpen ? 'topnav__links topnav__links--open' : 'topnav__links'}>
            {NAV.map((item) => (
              <button
                key={item.screen}
                type="button"
                className={screen === item.screen ? 'topnav__link topnav__link--active' : 'topnav__link'}
                aria-current={screen === item.screen ? 'page' : undefined}
                onClick={() => dispatch(screen === item.screen ? { type: 'close' } : { type: 'open', screen: item.screen })}
              >
                {item.title}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* key: при смене экрана содержимое монтируется заново и плавно появляется */}
      <main key={screen} className={screen === 'credits' ? 'main' : 'main main--wide'}>
        {screen === 'start' && (
          <StartScreen
            answered={answered}
            onStart={() => dispatch({ type: 'start' })}
            onResume={() => dispatch({ type: 'resume' })}
            onOpenKnowledgeBase={() => dispatch({ type: 'open', screen: 'kb' })}
          />
        )}
        {screen === 'quiz' && quizView && (
          // key: каждый вопрос — новый экран, от предыдущего не остаётся ни фото, ни анимаций
          <QuestionScreen
            key={quizView.current.question.id}
            step={quizView.current}
            selected={answers[quizView.current.question.id] ?? []}
            position={quizView.position}
            total={quizView.total}
            progress={quizView.progress}
            skipped={quizView.skipped}
            ranking={quizView.ranking}
            previousRanking={quizView.previousRanking}
            hasData={quizView.hasData}
            onToggle={(optionId) => dispatch({ type: 'toggle', optionId })}
            onNext={() => dispatch({ type: 'next' })}
            onBack={() => dispatch({ type: 'back' })}
          />
        )}
        {screen === 'result' && evaluation && (
          <ResultScreen
            evaluation={evaluation}
            answers={answers}
            onRestart={() => dispatch({ type: 'start' })}
            onOpenWorkingMemory={() => dispatch({ type: 'open', screen: 'wm' })}
          />
        )}
        {screen === 'kb' && <KnowledgeBaseScreen onClose={() => dispatch({ type: 'close' })} />}
        {screen === 'wm' && (
          <WorkingMemoryScreen
            answers={answers}
            onReset={() => dispatch({ type: 'reset' })}
            onClose={() => dispatch({ type: 'close' })}
          />
        )}
        {screen === 'credits' && <CreditsScreen onClose={() => dispatch({ type: 'close' })} />}
      </main>

      <footer className="footer">
        <div className="footer__info">
          <p>Домашнее задание по ОИС · МГТУ им. Н.Э. Баумана</p>
          <p>Выполнил: Волнухин Никита, СГН3-72Б</p>
        </div>
        <button type="button" className="footer__link" onClick={() => dispatch({ type: 'open', screen: 'credits' })}>
          Фото: авторы и лицензии
        </button>
      </footer>
    </div>
  );
}
