import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { baseTitle } from '../base.ts';
import { copyOf, emptyBase } from '../editor/ops.ts';
import { allQuestions, attributeRules } from '../engine/scoring.ts';
import type { KnowledgeBase } from '../engine/types.ts';
import { validateBase } from '../engine/validate.ts';
import { downloadBase, downloadText, readBaseFile } from '../files.ts';
import { refocus } from '../focus.ts';
import { plural } from '../plural.ts';
import { basePath, navigate } from '../router.ts';
import { createBase, deleteBase, exampleRecord, isFromNewerVersion, rawRecord, storageUsage, useStore } from '../storage.ts';
import type { BaseRecord } from '../storage.ts';
import { useConfirm } from './ConfirmDialog.tsx';
import { Photo } from './Photo.tsx';

/** Сколько ошибок импорта показывать: в сломанном файле их могут быть сотни. */
const MAX_SHOWN_ERRORS = 10;

export function HomeScreen() {
  const { records, broken } = useStore();
  const [importError, setImportError] = useState<{ file: string; errors: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const usage = Math.round(storageUsage() * 100);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  function create() {
    navigate(basePath(createBase(emptyBase()), 'edit'));
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем выбор, чтобы тот же файл можно было импортировать ещё раз.
    event.target.value = '';
    if (!file) return;
    const result = await readBaseFile(file);
    if (result.ok) {
      setImportError(null);
      navigate(basePath(createBase(result.base)));
    } else {
      setImportError({ file: file.name, errors: result.errors });
    }
  }

  return (
    <div className="home">
      <section className="home__intro">
        <h1 ref={titleRef} tabIndex={-1} className="home__title">
          Конструктор экспертных систем
        </h1>
        <p className="home__lead">
          Соберите экспертную систему на любую тему: атрибуты, объекты, вопросы и правила. База хранится в этом браузере, а
          другому человеку передаётся файлом JSON. Сервера нет.
        </p>
        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={create}>
            Создать базу
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => fileInput.current?.click()}>
            Импорт JSON
          </button>
          <input
            ref={fileInput}
            className="visually-hidden"
            type="file"
            accept=".json,application/json"
            tabIndex={-1}
            aria-label="Файл базы в формате JSON"
            onChange={importFile}
          />
        </div>
        {importError && (
          <div className="alert" role="alert">
            <p className="alert__title">Файл «{importError.file}» не импортирован</p>
            <ul className="alert__list">
              {importError.errors.slice(0, MAX_SHOWN_ERRORS).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {importError.errors.length > MAX_SHOWN_ERRORS && (
              <p className="alert__more">И ещё {plural(importError.errors.length - MAX_SHOWN_ERRORS, ['ошибка', 'ошибки', 'ошибок'])}.</p>
            )}
          </div>
        )}
      </section>

      <section className="section">
        <h2 id="my-bases" tabIndex={-1} className="section__title">
          Мои базы
        </h2>
        {records.length === 0 && broken.length === 0 ? (
          <p className="home__empty">Пока пусто. Создайте базу, импортируйте файл JSON или сделайте копию примера.</p>
        ) : (
          <ul className="base-grid">
            {records.map((record) => (
              <BaseCard key={record.id} record={record} />
            ))}
            {broken.map((id) => (
              <BrokenCard key={id} id={id} />
            ))}
          </ul>
        )}
        <p className="note">
          Базы хранятся только в этом браузере: чтобы не потерять базу или передать её, скачайте JSON. Хранилище занято примерно на{' '}
          {usage}&nbsp;%, на github.io оно общее для всех сайтов аккаунта.
        </p>
      </section>

      <section className="section">
        <h2 className="section__title">Пример</h2>
        <ExampleCard />
      </section>
    </div>
  );
}

/** Коротко о размере базы. Числа всегда из данных. */
function BaseFacts({ base }: { base: KnowledgeBase }) {
  const questions = allQuestions(base).length;
  const rules = attributeRules(base).length + base.rules.length;
  return (
    <ul className="facts facts--small" aria-label="Размер базы">
      <li>{plural(questions, ['вопрос', 'вопроса', 'вопросов'])}</li>
      <li>{plural(base.objects.length, ['объект', 'объекта', 'объектов'])}</li>
      <li>{plural(base.attributes.length, ['атрибут', 'атрибута', 'атрибутов'])}</li>
      <li>{plural(rules, ['правило', 'правила', 'правил'])}</li>
    </ul>
  );
}

/** Запись исчезла вместе с кнопкой удаления: фокус идёт на заголовок списка. */
function focusBaseList(): void {
  refocus(() => document.getElementById('my-bases'));
}

function BaseCard({ record }: { record: BaseRecord }) {
  const { id, base, updatedAt } = record;
  const errors = useMemo(() => validateBase(base).filter((issue) => issue.severity === 'error').length, [base]);
  const changed = new Date(updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const confirm = useConfirm();

  async function remove() {
    const yes = await confirm({
      title: `Удалить базу «${base.title.trim() || 'без названия'}»?`,
      message: 'Вернуть её можно будет, только если есть файл JSON.',
      action: 'Удалить',
    });
    if (!yes) return;
    deleteBase(id);
    focusBaseList();
  }

  return (
    <li className="base-card">
      <h3 className="base-card__title">
        <a href={basePath(id)}>{baseTitle(base)}</a>
      </h3>
      {base.description && <p className="base-card__text">{base.description}</p>}
      <BaseFacts base={base} />
      <p className="base-card__meta">
        Изменена {changed}
        {errors > 0 && <span className="base-card__errors">{plural(errors, ['ошибка', 'ошибки', 'ошибок'])}</span>}
      </p>
      <div className="base-card__actions">
        <a className="btn btn--primary btn--small" href={basePath(id)}>
          Открыть
        </a>
        <a className="btn btn--secondary btn--small" href={basePath(id, 'edit')}>
          Редактор
        </a>
        <button type="button" className="text-button" onClick={() => downloadBase(base)}>
          Скачать JSON
        </button>
        <button type="button" className="text-button" onClick={() => navigate(basePath(createBase(copyOf(base)), 'edit'))}>
          Копия
        </button>
        <button type="button" className="text-button" onClick={remove}>
          Удалить
        </button>
      </div>
    </li>
  );
}

function BrokenCard({ id }: { id: string }) {
  const confirm = useConfirm();
  const newer = isFromNewerVersion(id);

  async function remove() {
    const yes = await confirm({
      title: 'Удалить запись, которую не удалось прочитать?',
      message: 'После удаления её уже не получится скачать и поправить вручную.',
      action: 'Удалить',
    });
    if (!yes) return;
    deleteBase(id);
    focusBaseList();
  }
  return (
    <li className="base-card">
      <h3 className="base-card__title">Запись не читается</h3>
      <p className="base-card__text">
        {newer
          ? 'Эта база сохранена более новой версией конструктора. Обновите страницу: если сайт уже обновился, база откроется.'
          : 'Данные этой базы в браузере повреждены, открыть её нельзя. Запись можно скачать как есть и попробовать поправить вручную.'}
      </p>
      <div className="base-card__actions">
        <button type="button" className="text-button" onClick={() => downloadText(rawRecord(id) ?? '', newer ? 'Запись более новой версии.json' : 'Повреждённая запись.json')}>
          Скачать как есть
        </button>
        <button type="button" className="text-button" onClick={remove}>
          Удалить
        </button>
      </div>
    </li>
  );
}

function ExampleCard() {
  const { id, base } = exampleRecord;
  return (
    <article className="example-card">
      <Photo image={base.image} className="example-card__photo" />
      <div className="example-card__body">
        <p className="eyebrow">{base.subtitle}</p>
        <h3 className="example-card__title">{base.title}</h3>
        <p className="base-card__text">{base.description}</p>
        <BaseFacts base={base} />
        <div className="base-card__actions">
          <a className="btn btn--primary btn--small" href={basePath(id)}>
            Открыть тест
          </a>
          <button type="button" className="btn btn--secondary btn--small" onClick={() => navigate(basePath(createBase(copyOf(base)), 'edit'))}>
            Сделать копию для редактирования
          </button>
          <button type="button" className="text-button" onClick={() => downloadBase(base)}>
            Скачать JSON
          </button>
        </div>
      </div>
    </article>
  );
}
