import { quiz, steps } from '../data.ts';
import { plural } from '../plural.ts';
import { Photo } from './Photo.tsx';

interface StartScreenProps {
  /** Сколько вопросов уже отвечено в прошлый раз. */
  answered: number;
  onStart: () => void;
  onResume: () => void;
  onOpenKnowledgeBase: () => void;
}

const HOW_IT_WORKS = [
  `Ответь на ${steps.length} вопроса о мотивах, опыте и характере. В одних вопросах можно выбрать один ответ, в других — несколько. Если ответ на вопрос следует из предыдущих, система выведет его сама и не станет спрашивать.`,
  `Каждый ответ даёт «преимущество» свойствам деятельности, и после каждого ответа система пересчитывает рейтинг ${quiz.objects.length} видов волонтёрской деятельности.`,
  'В конце ты увидишь свою направленность, все виды деятельности по рангу и объяснение, почему лидеры тебе подходят.',
];

export function StartScreen({ answered, onStart, onResume, onOpenKnowledgeBase }: StartScreenProps) {
  const hasProgress = answered > 0;

  return (
    <div className="start">
      <section className="start__hero">
        <div className="start__intro">
          <p className="eyebrow">{quiz.subtitle}</p>
          <h1 className="start__title">{quiz.title}</h1>
          <p className="start__lead">{quiz.description}</p>
          <ul className="facts" aria-label="Коротко о тесте">
            <li>{plural(steps.length, ['вопрос', 'вопроса', 'вопросов'])}</li>
            <li>≈ {plural(quiz.estimatedMinutes, ['минута', 'минуты', 'минут'])}</li>
            <li>{plural(quiz.objects.length, ['вид деятельности', 'вида деятельности', 'видов деятельности'])}</li>
            <li>{plural(quiz.directions.length, ['направление', 'направления', 'направлений'])}</li>
          </ul>
          <div className="actions">
            {hasProgress ? (
              <>
                <button type="button" className="btn btn--primary" onClick={onResume}>
                  Продолжить
                </button>
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
          {hasProgress && (
            <p className="start__progress">
              Ты уже ответил(а) на {answered} из {plural(steps.length, ['вопроса', 'вопросов', 'вопросов'])}.
            </p>
          )}
        </div>
        <Photo name={quiz.image} className="start__photo" eager />
      </section>

      <section className="section">
        <h2 className="section__title">Направления</h2>
        <ul className="direction-grid">
          {quiz.directions.map((direction) => (
            <li key={direction.id} className="direction-card">
              <Photo name={direction.image} className="direction-card__photo" />
              <h3 className="direction-card__title">{direction.title}</h3>
              <p className="direction-card__text">{direction.tagline}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="section__title">Как это работает</h2>
        <ol className="how">
          {HOW_IT_WORKS.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
        <p className="note">
          Это прототип экспертной системы: её база знаний открыта —{' '}
          <button type="button" className="text-button text-button--inline" onClick={onOpenKnowledgeBase}>
            посмотреть объекты, атрибуты и правила
          </button>
          .
        </p>
      </section>
    </div>
  );
}
