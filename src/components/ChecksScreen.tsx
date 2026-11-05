import { useEffect, useMemo, useRef, useState } from 'react';
import { useBase } from '../base.ts';
import { IssueList, SelectField, TextField } from '../editor/fields.tsx';
import { addProfile } from '../editor/ops.ts';
import { EDITOR_SECTIONS } from '../editor/sections.ts';
import { infer, ruleTitle, selectedOptions, toggleOption } from '../engine/scoring.ts';
import type { Question, TestProfile } from '../engine/types.ts';
import { checkRequirements, runTestProfiles } from '../engine/validate.ts';
import type { ProfileResult } from '../engine/validate.ts';
import { refocus } from '../focus.ts';
import { plural, pluralWord } from '../plural.ts';
import { basePath } from '../router.ts';
import { updateBase } from '../storage.ts';
import { useConfirm } from './ConfirmDialog.tsx';

/** Проверки базы: ошибки (всегда), требования ДЗ, тестовые профили. */
export function ChecksScreen() {
  const confirm = useConfirm();
  const { id, base, issues, builtIn, canRun } = useBase();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const addProfileRef = useRef<HTMLButtonElement>(null);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const requirements = useMemo(() => checkRequirements(base), [base]);
  const results = useMemo(() => runTestProfiles(base), [base]);
  const passed = results.filter((result) => result.problems.length === 0).length;
  const requirementsMet = requirements.filter((row) => row.ok).length;
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  function createProfile() {
    updateBase(id, (draft) => void addProfile(draft));
    setEditing(base.testProfiles.length);
  }

  async function removeProfile(index: number) {
    const yes = await confirm({ title: `Удалить профиль «${base.testProfiles[index].name || 'без названия'}»?`, action: 'Удалить' });
    if (!yes) return;
    updateBase(id, (draft) => void draft.testProfiles.splice(index, 1));
    setEditing(null);
    refocus(() => addProfileRef.current);
  }

  return (
    <article className="checks">
      <h1 ref={titleRef} tabIndex={-1} className="page__title">
        Проверка базы
      </h1>
      <p className="page__lead">Пересчитывается сама при каждом изменении базы.</p>

      <section className="section">
        <h2 className="section__title">Ошибки в базе</h2>
        <p className={canRun ? 'check-summary check-summary--ok' : 'check-summary check-summary--fail'}>
          {canRun ? 'Ошибок нет, тест можно проходить.' : `${plural(errors.length, ['ошибка', 'ошибки', 'ошибок'])}: пока они есть, тест не запускается.`}
          {warnings.length > 0 &&
            ` ${plural(warnings.length, ['заметка', 'заметки', 'заметок'])}: на работу теста ${pluralWord(warnings.length, ['не влияет', 'не влияют', 'не влияют'])}, но автору стоит посмотреть.`}
        </p>
        {EDITOR_SECTIONS.map((section) => {
          const found = issues.filter((issue) => issue.section === section.id);
          if (found.length === 0) return null;
          return (
            <div key={section.id} className="check-group">
              <h3 className="check-group__title">
                {builtIn ? section.title : <a href={basePath(id, 'edit', section.id)}>{section.title}</a>}
              </h3>
              <IssueList issues={found.map((issue) => ({ ...issue, target: undefined }))} />
            </div>
          );
        })}
      </section>

      <section className="section">
        <h2 className="section__title">Требования ДЗ</h2>
        <p className="section__lead">
          Выполнено {requirementsMet} из {requirements.length}. Это требования к прототипу из задания: для других задач они необязательны, поэтому на
          запуск теста не влияют.
        </p>
        <div className="table-scroll">
          <table className="kb-table kb-table--wide">
            <thead>
              <tr>
                <th scope="col">Требование</th>
                <th scope="col">Нужно</th>
                <th scope="col">В базе</th>
                <th scope="col">
                  <span className="visually-hidden">Выполнено</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {requirements.map((row) => (
                <tr key={row.title}>
                  <th scope="row" className="kb-table__name">
                    {row.title}
                  </th>
                  <td className="wm__source">{row.need}</td>
                  <td>{row.actual}</td>
                  <td>
                    <CheckMark ok={row.ok} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">Тестовые профили</h2>
        <p className="section__lead">
          {results.length > 0 ? `Проходят ${passed} из ${results.length}. ` : ''}
          Профиль — выдуманный человек: его ответы и то, что система должна ему показать. Если после правки базы профиль перестал проходить, значит, правила
          разошлись со смыслом ответов.{' '}
          {!builtIn && 'Профиль можно собрать вручную или сохранить с экрана результата, пройдя тест.'}
        </p>
        {results.length > 0 && (
          <ol className="profile-list">
            {results.map((result, index) => (
              <ProfileCard
                key={index}
                result={result}
                editable={!builtIn}
                editing={editing === index}
                onToggle={() => setEditing(editing === index ? null : index)}
                onRemove={() => removeProfile(index)}
                onChange={(change) => updateBase(id, (draft) => change(draft.testProfiles[index]))}
              />
            ))}
          </ol>
        )}
        {!builtIn && (
          <div className="actions">
            <button ref={addProfileRef} type="button" className="btn btn--secondary btn--small" onClick={createProfile}>
              Добавить профиль
            </button>
          </div>
        )}
      </section>
    </article>
  );
}

function CheckMark({ ok }: { ok: boolean }) {
  return (
    <span className={ok ? 'check-mark check-mark--ok' : 'check-mark check-mark--fail'} role="img" aria-label={ok ? 'Проходит' : 'Не проходит'}>
      {ok ? '✓' : '✗'}
    </span>
  );
}

/** Процент с одним знаком после запятой: 95,8 %. На экране проверки важна точность. */
function exactPercent(value: number): string {
  return `${Math.round(value * 10) / 10}`.replace('.', ',') + '\u00a0%';
}

interface ProfileCardProps {
  result: ProfileResult;
  editable: boolean;
  editing: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (change: (profile: TestProfile) => void) => void;
}

function ProfileCard({ result, editable, editing, onToggle, onRemove, onChange }: ProfileCardProps) {
  const { base, groupById } = useBase();
  const { profile, evaluation, asked, problems } = result;
  const { verdict } = evaluation;
  const titleOfObject = (id: string) => base.objects.find((object) => object.id === id)?.title ?? id;

  const expected = [
    profile.expectGroup?.length ? `группа: ${profile.expectGroup.map((id) => groupById[id]?.title ?? id).join(' или ')}` : '',
    profile.expectTop?.length ? `в тройке хотя бы один из: ${profile.expectTop.map(titleOfObject).join(', ')}` : '',
    profile.expectClose === true ? 'второе место почти равное' : profile.expectClose === false ? 'второе место заметно отстаёт' : '',
    profile.expectWeak === true ? 'итог слабый' : profile.expectWeak === false ? 'итог выраженный' : '',
  ].filter(Boolean);

  return (
    <li className="profile-card">
      <div className="profile-card__head">
        <CheckMark ok={problems.length === 0} />
        <h3 className="profile-card__name">{profile.name || 'Без названия'}</h3>
        {editable && (
          <span className="profile-card__actions">
            <button type="button" className="text-button" aria-expanded={editing} onClick={onToggle}>
              {editing ? 'Свернуть' : 'Изменить'}
            </button>
            <button type="button" className="text-button" onClick={onRemove}>
              Удалить
            </button>
          </span>
        )}
      </div>
      {profile.story && <p className="profile-card__story">{profile.story}</p>}
      <dl className="profile-card__facts">
        <div>
          <dt>Ожидали</dt>
          <dd>{expected.length > 0 ? expected.join('; ') : 'ожидания не заданы'}</dd>
        </div>
        {verdict && (
          <div>
            <dt>Итог</dt>
            <dd>
              {verdict.winner.group.title} {exactPercent(verdict.winner.percent)}
              {verdict.isClose && ', второе место почти равное'}
              {verdict.isWeak && ', итог слабый'}
            </dd>
          </div>
        )}
        <div>
          <dt>Тройка</dt>
          <dd>{evaluation.objects.slice(0, 3).map((item) => `${item.object.title} ${exactPercent(item.score * 100)}`).join('; ')}</dd>
        </div>
        <div>
          <dt>Задано</dt>
          <dd>{plural(asked, ['вопрос', 'вопроса', 'вопросов'])}</dd>
        </div>
      </dl>
      {problems.length > 0 && (
        <ul className="profile-card__problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {editing && <ProfileForm profile={profile} onChange={onChange} />}
    </li>
  );
}

/** Значение необязательного да/нет для списка: «не проверять», «да», «нет». */
function triState(value: boolean | undefined): string {
  return value === undefined ? '' : value ? 'yes' : 'no';
}

function ProfileForm({ profile, onChange }: { profile: TestProfile; onChange: (change: (profile: TestProfile) => void) => void }) {
  const { base } = useBase();
  const hasGroups = base.groups.length > 0;
  const triOptions = [
    { value: '', label: 'Не проверять' },
    { value: 'yes', label: 'Да' },
    { value: 'no', label: 'Нет' },
  ];
  const setTri = (field: 'expectClose' | 'expectWeak', value: string) =>
    onChange((item) => {
      if (value === '') delete item[field];
      else item[field] = value === 'yes';
    });
  const toggleInList = (field: 'expectGroup' | 'expectTop', id: string, checked: boolean) =>
    onChange((item) => {
      const list = (item[field] ?? []).filter((existing) => existing !== id);
      if (checked) list.push(id);
      if (list.length > 0) item[field] = list;
      else delete item[field];
    });

  return (
    <div className="profile-form">
      <div className="form-grid">
        <TextField label="Имя" value={profile.name} onChange={(value) => onChange((item) => void (item.name = value))} />
        <TextField
          label="Кто это"
          value={profile.story ?? ''}
          onChange={(value) =>
            onChange((item) => {
              if (value) item.story = value;
              else delete item.story;
            })
          }
        />
        {hasGroups && (
          <>
            <SelectField label="Второе место почти равное" value={triState(profile.expectClose)} options={triOptions} onChange={(value) => setTri('expectClose', value)} />
            <SelectField label="Итог слабо выражен" value={triState(profile.expectWeak)} options={triOptions} onChange={(value) => setTri('expectWeak', value)} />
          </>
        )}
      </div>

      {hasGroups && (
        <fieldset className="choice-list">
          <legend className="field__label">Итог должен быть одной из групп</legend>
          {base.groups.map((group) => (
            <label key={group.id} className="checkbox">
              <input
                type="checkbox"
                checked={profile.expectGroup?.includes(group.id) ?? false}
                onChange={(event) => toggleInList('expectGroup', group.id, event.target.checked)}
              />
              <span>{group.title || 'Без названия'}</span>
            </label>
          ))}
        </fieldset>
      )}

      <fieldset className="choice-list">
        <legend className="field__label">Хотя бы один из этих объектов должен попасть в тройку лидеров</legend>
        {base.objects.map((object) => (
          <label key={object.id} className="checkbox">
            <input
              type="checkbox"
              checked={profile.expectTop?.includes(object.id) ?? false}
              onChange={(event) => toggleInList('expectTop', object.id, event.target.checked)}
            />
            <span>{object.title || 'Без названия'}</span>
          </label>
        ))}
      </fieldset>

      <AnswersForm profile={profile} onChange={onChange} />
    </div>
  );
}

/** Ответы профиля. Вопрос, значение которого выводит правило, отвечать не нужно. */
function AnswersForm({ profile, onChange }: { profile: TestProfile; onChange: (change: (profile: TestProfile) => void) => void }) {
  const { base, steps } = useBase();
  const { answers: effective, inferred } = infer(base, profile.answers);
  const missing = steps.filter(({ question }) => selectedOptions(question, effective).length === 0).length;

  const setAnswer = (question: Question, selected: string[]) =>
    onChange((item) => {
      if (selected.length > 0) item.answers[question.id] = selected;
      else delete item.answers[question.id];
    });

  return (
    <details className="editor-details" open={missing > 0}>
      <summary>Ответы{missing > 0 ? `: не хватает ${plural(missing, ['ответа', 'ответов', 'ответов'])}` : ''}</summary>
      <div className="profile-answers">
        {steps.map(({ question, index }) => {
          const label = `${index + 1}. ${question.parameter || question.text || 'Без названия'}`;
          const rule = inferred.get(question.id);
          if (rule) {
            return (
              <p key={question.id} className="profile-answers__inferred">
                <span className="field__label">{label}</span>
                <span className="field__hint">
                  Выводится правилом {ruleTitle(rule)}: «{selectedOptions(question, effective)[0]?.text}»
                </span>
              </p>
            );
          }
          const selected = profile.answers[question.id] ?? [];
          if (question.type === 'single') {
            return (
              <SelectField
                key={question.id}
                label={label}
                value={selected[0] ?? ''}
                options={[{ value: '', label: 'Нет ответа' }, ...question.options.map((option, i) => ({ value: option.id, label: option.text || `Вариант ${i + 1}` }))]}
                onChange={(value) => setAnswer(question, value ? [value] : [])}
              />
            );
          }
          return (
            <fieldset key={question.id} className="choice-list">
              <legend className="field__label">{label}</legend>
              {question.options.map((option, i) => (
                <label key={option.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={selected.includes(option.id)}
                    onChange={() => setAnswer(question, toggleOption(question, selected, option.id))}
                  />
                  <span>{option.text || `Вариант ${i + 1}`}</span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
    </details>
  );
}
