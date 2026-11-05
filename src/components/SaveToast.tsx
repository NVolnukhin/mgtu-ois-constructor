// Всплывашка «Изменения сохранены». База сохраняется при каждом нажатии клавиши, поэтому сообщать о каждой правке
// нельзя: всплывашка одна, появляется, когда человек сделал паузу, и не чаще раза в полминуты. Между показами
// о последнем сохранении спокойно говорит строка в шапке редактора. Если запись не удалась, всплывашки нет:
// об этом предупреждает баннер вверху страницы.

import { useEffect, useState } from 'react';
import { onBaseEdited } from '../storage.ts';

/** Сколько ждать тишины после правки. */
const PAUSE_MS = 800;
const VISIBLE_MS = 2500;
const LEAVING_MS = 200;
/** Чаще этого всплывашка не показывается. */
const COOLDOWN_MS = 30_000;

export function SaveToast() {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'leaving'>('hidden');

  useEffect(() => {
    let lastShown = -Infinity;
    let pause: ReturnType<typeof setTimeout> | undefined;
    let hide: ReturnType<typeof setTimeout> | undefined;
    let remove: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = onBaseEdited((saved) => {
      clearTimeout(pause);
      if (!saved) return;
      pause = setTimeout(() => {
        if (Date.now() - lastShown < COOLDOWN_MS) return;
        lastShown = Date.now();
        setPhase('visible');
        hide = setTimeout(() => {
          setPhase('leaving');
          remove = setTimeout(() => setPhase('hidden'), LEAVING_MS);
        }, VISIBLE_MS);
      }, PAUSE_MS);
    });

    return () => {
      unsubscribe();
      clearTimeout(pause);
      clearTimeout(hide);
      clearTimeout(remove);
    };
  }, []);

  return (
    <div className="toast-region" role="status">
      {phase !== 'hidden' && (
        <div className={phase === 'leaving' ? 'toast toast--leaving' : 'toast'}>
          <svg className="toast__mark" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#e7f6e8" />
            <path d="m18 8-8 8-4-4" fill="none" stroke="#0b5d10" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Изменения сохранены
        </div>
      )}
    </div>
  );
}
