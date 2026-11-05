import { percent, useBase } from '../base.ts';
import type { ObjectScore } from '../engine/scoring.ts';

interface RankingListProps {
  items: ObjectScore[];
  /** Места до последнего ответа: id объекта → место. Если заданы, рядом показывается сдвиг. */
  previous?: Map<string, number>;
  compact?: boolean;
}

/** Ранжированный список объектов: место, название, группа, совпадение. */
export function RankingList({ items, previous, compact = false }: RankingListProps) {
  const { groupById } = useBase();
  return (
    <ol className={compact ? 'ranking ranking--compact' : 'ranking'}>
      {items.map((item) => {
        const before = previous?.get(item.object.id);
        const shift = before ? before - item.rank : 0;
        const group = item.object.group ? groupById[item.object.group] : undefined;
        return (
          // Совпадение ниже 50 % — объект скорее противоречит ответам, показываем его приглушённо.
          <li key={item.object.id} className={item.score >= 0.5 ? 'ranking__item' : 'ranking__item ranking__item--weak'}>
            <span className="ranking__rank">{item.rank}</span>
            <span className="ranking__body">
              <span className="ranking__title">{item.object.title}</span>
              {group && <span className="ranking__meta">{group.title}</span>}
              <span className="ranking__track" aria-hidden="true">
                <span className="ranking__fill" style={{ width: `${item.score * 100}%` }} />
              </span>
            </span>
            <span className="ranking__side">
              <span className="ranking__score">{percent(item.score)}</span>
              {shift !== 0 && (
                <span
                  className={shift > 0 ? 'shift shift--up' : 'shift shift--down'}
                  title={shift > 0 ? `Поднялся на ${shift}` : `Опустился на ${-shift}`}
                >
                  {shift > 0 ? '▲' : '▼'}
                  {Math.abs(shift)}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
