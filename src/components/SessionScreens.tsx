import { useEffect, useMemo } from 'react';
import { testPath, useBase } from '../base.ts';
import { askedQuestions, evaluate, firstUnanswered, infer, isComplete, liveRanking, nearestAsked, resumeStep, selectedOptions } from '../engine/scoring.ts';
import type { Step } from '../base.ts';
import { basePath, navigate } from '../router.ts';
import type { BaseSection } from '../router.ts';
import { useQuizState } from '../useQuizState.ts';
import { BaseLayout } from './BaseLayout.tsx';
import { CreditsScreen } from './CreditsScreen.tsx';
import { KnowledgeBaseScreen } from './KnowledgeBaseScreen.tsx';
import { QuestionScreen } from './QuestionScreen.tsx';
import type { SkippedQuestion } from './QuestionScreen.tsx';
import { ResultScreen } from './ResultScreen.tsx';
import { StartScreen } from './StartScreen.tsx';
import { WorkingMemoryScreen } from './WorkingMemoryScreen.tsx';

/** Экраны, которым нужен ход теста: тест, результат, база знаний, рабочая БД. */
export function SessionScreens({ section }: { section: BaseSection }) {
  const compiled = useBase();
  const { id, base, steps, canRun } = compiled;
  const [state, dispatch] = useQuizState(compiled);
  const { step, answers } = state;

  const complete = useMemo(() => isComplete(base, answers), [base, answers]);
  const answered = useMemo(() => {
    const { answers: effective } = infer(base, answers);
    return steps.filter(({ question }) => selectedOptions(question, effective).length > 0).length;
  }, [base, steps, answers]);
  const returnPath = testPath(compiled, answers);

  // Тест не открывается, если в базе есть ошибки; результат — пока есть неотвеченные вопросы.
  const blocked = (section === 'test' && !canRun) || (section === 'result' && !(canRun && complete));
  const shown: BaseSection = blocked ? 'start' : section;
  useEffect(() => {
    if (blocked) navigate(basePath(id), true);
  }, [blocked, id]);

  // Новый вопрос — прокручиваем страницу наверх.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const evaluation = useMemo(() => (shown === 'result' ? evaluate(base, answers) : null), [shown, base, answers]);

  const quizView = useMemo(() => {
    if (shown !== 'test') return null;
    const current = steps[step];
    const asked = askedQuestions(base, answers);
    const { answers: effective, inferred } = infer(base, answers);
    // Рейтинг до ответа на текущий вопрос — чтобы показать, как этот ответ сдвинул места.
    const withoutCurrent = { ...answers };
    delete withoutCurrent[current.question.id];
    // Вопросы между предыдущим заданным и текущим, которые вывели правила.
    const previousAsked = [...asked].reverse().find((q) => steps.find((s) => s.question === q)!.index < step);
    const from = previousAsked ? steps.find((s) => s.question === previousAsked)!.index + 1 : 0;
    const skippedAmong = (range: Step[]): SkippedQuestion[] =>
      range.flatMap(({ question }) => {
        const rule = inferred.get(question.id);
        const option = selectedOptions(question, effective)[0];
        return rule && option ? [{ question, rule, option }] : [];
      });
    // Блоки, где что-то будет спрошено: пустые и полностью выведенные правилами человек не проходит.
    const askedBlocks = base.blocks.filter((block) => block.questions.some((q) => asked.includes(q)));
    const blockPosition = askedBlocks.indexOf(current.block);
    const progress = askedBlocks.map((block, index) => {
      if (index !== blockPosition) return index < blockPosition ? 1 : 0;
      const inBlock = asked.filter((q) => block.questions.includes(q));
      return (inBlock.indexOf(current.question) + 1) / inBlock.length;
    });
    const missing = firstUnanswered(base, answers);
    const lastAsked = nearestAsked(base, step + 1, 1, answers) === null;
    return {
      current,
      position: asked.indexOf(current.question) + 1,
      total: asked.length,
      // Дальше вопросов нет, и неотвеченных позади тоже: следующий шаг — результат.
      finishing: lastAsked && (missing === null || missing === step),
      blockNumber: blockPosition + 1,
      // Первый задаваемый вопрос блока: здесь показывается описание блока.
      blockStart: asked.find((q) => current.block.questions.includes(q)) === current.question,
      skipped: skippedAmong(steps.slice(from, step)),
      // После последнего заданного вопроса плашку показать негде, поэтому она видна прямо на нём.
      skippedAfter: lastAsked ? skippedAmong(steps.slice(step + 1)) : [],
      progress,
      ranking: liveRanking(base, answers),
      // До первого ответа рейтинга ещё не было — сдвигать места не от чего.
      previousRanking: Object.values(infer(base, withoutCurrent).answers).some((ids) => ids.length > 0)
        ? liveRanking(base, withoutCurrent)
        : null,
      hasData: Object.values(effective).some((ids) => ids.length > 0),
    };
  }, [shown, step, base, steps, answers]);

  function start() {
    dispatch({ type: 'reset' });
    navigate(basePath(id, 'test'));
  }

  function resume() {
    dispatch({ type: 'goto', step: resumeStep(base, answers, step) });
    navigate(basePath(id, 'test'));
  }

  function next() {
    const target = nearestAsked(base, step + 1, 1, answers) ?? firstUnanswered(base, answers);
    if (target === null) navigate(basePath(id, 'result'));
    else dispatch({ type: 'goto', step: target });
  }

  function back() {
    const target = nearestAsked(base, step - 1, -1, answers);
    if (target === null) navigate(basePath(id));
    else dispatch({ type: 'goto', step: target });
  }

  return (
    <BaseLayout section={shown} returnPath={returnPath} wide={shown !== 'credits'}>
      {shown === 'start' && <StartScreen answered={answered} complete={complete} onStart={start} onResume={resume} />}
      {shown === 'test' && quizView && (
        // key: каждый вопрос — новый экран, от предыдущего не остаётся ни фото, ни анимаций
        <QuestionScreen
          key={quizView.current.question.id}
          step={quizView.current}
          selected={answers[quizView.current.question.id] ?? []}
          position={quizView.position}
          total={quizView.total}
          finishing={quizView.finishing}
          blockStart={quizView.blockStart}
          blockNumber={quizView.blockNumber}
          progress={quizView.progress}
          skipped={quizView.skipped}
          skippedAfter={quizView.skippedAfter}
          ranking={quizView.ranking}
          previousRanking={quizView.previousRanking}
          hasData={quizView.hasData}
          onToggle={(optionId) => dispatch({ type: 'toggle', optionId })}
          onNext={next}
          onBack={back}
        />
      )}
      {shown === 'result' && evaluation && <ResultScreen evaluation={evaluation} answers={answers} onRestart={start} />}
      {shown === 'kb' && <KnowledgeBaseScreen returnPath={returnPath} />}
      {shown === 'wm' && <WorkingMemoryScreen answers={answers} returnPath={returnPath} onReset={() => dispatch({ type: 'reset' })} />}
      {shown === 'credits' && <CreditsScreen returnPath={returnPath} />}
    </BaseLayout>
  );
}
