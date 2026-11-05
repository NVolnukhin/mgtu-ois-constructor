import { HOME_PATH } from '../router.ts';
import { useStore } from '../storage.ts';

/** Предупреждение, что данные не сохранились. Стоит под шапкой и закреплено вместе с ней: навигация остаётся доступной. */
export function StorageBanner() {
  const { problem } = useStore();
  if (!problem) return null;
  return (
    <p className="banner" role="alert">
      {problem === 'quota' ? (
        <>
          Место в браузере закончилось: изменения есть только в этой вкладке. Скачайте базу в JSON или <a href={HOME_PATH}>удалите ненужные базы</a>, и
          сохранение повторится.
        </>
      ) : (
        'Браузер не даёт сохранять (так бывает в приватном режиме): изменения пропадут при закрытии вкладки. Скачайте базу в JSON.'
      )}
    </p>
  );
}
