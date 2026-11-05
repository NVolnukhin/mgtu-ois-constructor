import { useState } from 'react';
import { TOP_COUNT } from '../engine/scoring.ts';
import type { ObjectScore } from '../engine/scoring.ts';
import { RankingList } from './RankingList.tsx';

interface LiveRankingProps {
  /** Рейтинг с учётом текущего ответа. */
  ranking: ObjectScore[];
  /** Рейтинг до ответа на текущий вопрос — чтобы показать, как ответ сдвинул места. */
  previous: ObjectScore[] | null;
  /** Получен хотя бы один параметр. */
  hasData: boolean;
}

/** Панель на экране вопроса: лучшие виды деятельности по уже данным ответам. */
export function LiveRanking({ ranking, previous, hasData }: LiveRankingProps) {
  const [showAll, setShowAll] = useState(false);
  const previousRanks = previous ? new Map(previous.map((item) => [item.object.id, item.rank])) : undefined;

  return (
    <section className="live" aria-labelledby="live-title">
      <div className="live__head">
        <h2 id="live-title" className="live__title">
          Сейчас тебе подходят
        </h2>
        <p className="live__note">Рейтинг пересчитывается после каждого ответа</p>
      </div>
      {hasData ? (
        <>
          <p className="visually-hidden" aria-live="polite">
            Первое место: {ranking[0].object.title}
          </p>
          <RankingList items={showAll ? ranking : ranking.slice(0, TOP_COUNT)} previous={previousRanks} compact />
          <button type="button" className="text-button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
            {showAll ? `Показать только ${TOP_COUNT} лучших` : `Показать все ${ranking.length}`}
          </button>
        </>
      ) : (
        <p className="live__empty">Выбери ответ — и здесь появятся виды деятельности, которые тебе подходят.</p>
      )}
    </section>
  );
}
