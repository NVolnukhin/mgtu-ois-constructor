import { useState } from 'react';
import { useBase } from '../base.ts';
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

/** Панель на экране вопроса: лучшие объекты по уже данным ответам. */
export function LiveRanking({ ranking, previous, hasData }: LiveRankingProps) {
  const { base } = useBase();
  const [showAll, setShowAll] = useState(false);
  const { topCount } = base.settings;
  const previousRanks = previous ? new Map(previous.map((item) => [item.object.id, item.rank])) : undefined;

  return (
    <section className="live" aria-labelledby="live-title">
      <div className="live__head">
        <h2 id="live-title" className="live__title">
          Сейчас подходят лучше всего
        </h2>
        <p className="live__note">Рейтинг пересчитывается после каждого ответа</p>
      </div>
      {hasData && ranking.length > 0 ? (
        <>
          <p className="visually-hidden" aria-live="polite">
            Первое место: {ranking[0].object.title}
          </p>
          <RankingList items={showAll ? ranking : ranking.slice(0, topCount)} previous={previousRanks} compact />
          {ranking.length > topCount && (
            <button type="button" className="text-button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
              {showAll ? `Показать только ${topCount} лучших` : `Показать все ${ranking.length}`}
            </button>
          )}
        </>
      ) : (
        <p className="live__empty">После первого ответа здесь появится рейтинг.</p>
      )}
    </section>
  );
}
