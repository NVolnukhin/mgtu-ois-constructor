import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useBase } from '../base.ts';
import type { IssueSection } from '../engine/validate.ts';
import type { KnowledgeBase } from '../engine/types.ts';
import { downloadBase } from '../files.ts';
import { plural } from '../plural.ts';
import { basePath, navigate } from '../router.ts';
import { createBase, updateBase, useStore } from '../storage.ts';
import { AttributesSection } from './AttributesSection.tsx';
import { GeneralSection } from './GeneralSection.tsx';
import { GroupsSection } from './GroupsSection.tsx';
import { ObjectsSection } from './ObjectsSection.tsx';
import { copyOf } from './ops.ts';
import { QuestionsSection } from './QuestionsSection.tsx';
import { RulesSection } from './RulesSection.tsx';
import { EDITOR_SECTIONS } from './sections.ts';
import { SettingsSection } from './SettingsSection.tsx';

/** Как разделы редактора меняют базу: правят черновик, а он сразу сохраняется. */
export type UpdateBase = (change: (draft: KnowledgeBase) => void) => void;

/** Когда база сохранена последний раз: сегодня — только время, иначе ещё и дата. */
function savedLabel(time: number): string {
  const date = new Date(time);
  if (date.toDateString() === new Date().toDateString()) {
    return `в ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  }
  return date.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

/** Редактор базы. Рассчитан на компьютер, на телефоне работает с прокруткой. */
export function EditorScreen({ tab }: { tab?: string }) {
  const { id, base, issues, builtIn, canRun, steps } = useBase();
  const { records, problem } = useStore();
  const savedAt = records.find((record) => record.id === id)?.updatedAt;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const update: UpdateBase = useCallback((change) => updateBase(id, change), [id]);
  const section = EDITOR_SECTIONS.find((item) => item.id === tab)?.id ?? 'general';
  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const next = EDITOR_SECTIONS[EDITOR_SECTIONS.findIndex((item) => item.id === section) + 1];

  const counts = useMemo<Partial<Record<IssueSection, number>>>(
    () => ({
      attributes: base.attributes.length,
      groups: base.groups.length,
      objects: base.objects.length,
      questions: steps.length,
      rules: base.rules.length,
    }),
    [base, steps],
  );

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  if (builtIn) {
    return (
      <article className="kb">
        <h1 ref={titleRef} tabIndex={-1} className="page__title">
          Редактор
        </h1>
        <p className="page__lead">
          Это встроенный пример, менять его нельзя. Сделайте копию: она появится в «Моих базах», и в ней можно менять всё.
        </p>
        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={() => navigate(basePath(createBase(copyOf(base)), 'edit'))}>
            Сделать копию для редактирования
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="editor">
      <header className="editor__head">
        <div>
          <h1 ref={titleRef} tabIndex={-1} className="page__title">
            Редактор
          </h1>
          <p className="editor__status">
            {problem ? (
              <span className="editor__unsaved">Последние изменения не сохранены.</span>
            ) : (
              <>Изменения сохраняются сразу{savedAt ? `, последнее сохранение ${savedLabel(savedAt)}` : ''}.</>
            )}{' '}
            {errors > 0 ? (
              <a href={basePath(id, 'checks')}>В базе {plural(errors, ['ошибка', 'ошибки', 'ошибок'])}: тест пока не запускается</a>
            ) : (
              'Ошибок нет.'
            )}
          </p>
        </div>
        <div className="editor__actions">
          <button type="button" className="btn btn--secondary btn--small" onClick={() => downloadBase(base)}>
            Скачать JSON
          </button>
          {canRun && (
            <a className="btn btn--primary btn--small" href={basePath(id)}>
              Пройти тест
            </a>
          )}
        </div>
      </header>

      <div className="editor__layout">
        <nav className="editor__nav" aria-label="Разделы редактора">
          {EDITOR_SECTIONS.map((item) => {
            const failed = issues.some((issue) => issue.section === item.id && issue.severity === 'error');
            const count = counts[item.id];
            return (
              <a
                key={item.id}
                className={item.id === section ? 'editor__link editor__link--active' : 'editor__link'}
                aria-current={item.id === section ? 'page' : undefined}
                href={basePath(id, 'edit', item.id)}
              >
                <span>{item.title}</span>
                {count !== undefined && <span className="editor__count">{count}</span>}
                {failed && <span className="editor__failed" title="В разделе есть ошибки" aria-label="В разделе есть ошибки" />}
              </a>
            );
          })}
        </nav>

        <div className="editor__content" key={section}>
          {section === 'general' && <GeneralSection update={update} />}
          {section === 'attributes' && <AttributesSection update={update} />}
          {section === 'groups' && <GroupsSection update={update} />}
          {section === 'objects' && <ObjectsSection update={update} />}
          {section === 'questions' && <QuestionsSection update={update} />}
          {section === 'rules' && <RulesSection update={update} />}
          {section === 'settings' && <SettingsSection update={update} />}
          {next && (
            <p className="editor__next">
              <a className="btn btn--secondary btn--small" href={basePath(id, 'edit', next.id)}>
                Дальше: {next.title.toLowerCase()}
              </a>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
