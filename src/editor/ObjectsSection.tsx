import { memo } from 'react';
import { useBase } from '../base.ts';
import { useConfirm } from '../components/ConfirmDialog.tsx';
import { MAX_TEXT_LENGTH } from '../engine/parse.ts';
import { attributeLabel, level } from '../engine/scoring.ts';
import type { Attribute, Group, RankedObject, TestProfile } from '../engine/types.ts';
import { VALUE_RANGE } from '../engine/validate.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { IssueList, RowActions, ScaleSelect, SectionHead } from './fields.tsx';
import { addObject, moveItem, profilesExpectingObject, profilesPhrase, removeObject } from './ops.ts';

export function ObjectsSection({ update }: { update: UpdateBase }) {
  const { base, issues } = useBase();
  const { attributes, groups, objects, testProfiles } = base;
  const hasAttributes = attributes.length > 0;
  const headRows = hasAttributes ? 2 : 1;

  return (
    <section>
      <SectionHead title="Объекты">
        То, что система ранжирует. Число в ячейке — насколько у объекта выражен атрибут: {VALUE_RANGE.min} — нет, {VALUE_RANGE.max} — сильно.
      </SectionHead>

      {attributes.length === 0 && <p className="editor-empty">Сначала добавьте атрибуты: объекты описываются их значениями.</p>}

      {objects.length > 0 && (
        <div className="table-scroll">
          <table className="kb-table matrix">
            {/* Над столбцами атрибутов общая подпись «Атрибуты», как в базе знаний. */}
            <colgroup span={groups.length > 0 ? 2 : 1} />
            {hasAttributes && <colgroup span={attributes.length} />}
            <colgroup span={1} />
            <thead>
              <tr>
                <th scope="col" rowSpan={headRows} className="matrix__sticky">
                  Объект и описание
                </th>
                {groups.length > 0 && (
                  <th scope="col" rowSpan={headRows}>
                    Группа
                  </th>
                )}
                {hasAttributes && (
                  <th scope="colgroup" colSpan={attributes.length} className="kb-table__group">
                    Атрибуты
                  </th>
                )}
                <th scope="col" rowSpan={headRows}>
                  <span className="visually-hidden">Действия</span>
                </th>
              </tr>
              {hasAttributes && (
                <tr>
                  {attributes.map((attribute) => (
                    <th key={attribute.id} scope="col" className="kb-table__attr" title={attribute.title}>
                      {attributeLabel(attribute) || '—'}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {objects.map((object, index) => (
                <ObjectRow
                  key={object.id}
                  object={object}
                  index={index}
                  isLast={index === objects.length - 1}
                  attributes={attributes}
                  groups={groups}
                  testProfiles={testProfiles}
                  update={update}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn btn--secondary btn--small" onClick={() => update((draft) => void addObject(draft))}>
          Добавить объект
        </button>
      </div>
      <IssueList issues={issues.filter((issue) => issue.section === 'objects')} />
    </section>
  );
}

interface ObjectRowProps {
  object: RankedObject;
  index: number;
  isLast: boolean;
  attributes: Attribute[];
  groups: Group[];
  testProfiles: TestProfile[];
  update: UpdateBase;
}

/** Строка таблицы. В большой базе таблица — тысячи полей, поэтому при вводе перерисовывается только изменившаяся строка. */
const ObjectRow = memo(function ObjectRow({ object, index, isLast, attributes, groups, testProfiles, update }: ObjectRowProps) {
  const confirm = useConfirm();

  const edit = (change: (item: RankedObject) => void) =>
    update((draft) => {
      const item = draft.objects.find((candidate) => candidate.id === object.id);
      if (item) change(item);
    });

  async function remove() {
    const profiles = profilesExpectingObject(testProfiles, object.id);
    const yes = await confirm({
      title: `Удалить объект «${object.title || 'без названия'}»?`,
      message: profiles.length > 0 ? `Он пропадёт из ожиданий ${profilesPhrase(profiles)}.` : undefined,
      action: 'Удалить',
    });
    if (yes) update((draft) => removeObject(draft, object.id));
  }

  return (
    <tr id={`entity-${object.id}`}>
      <th scope="row" className="matrix__sticky matrix__name">
        <input
          className="cell-input cell-input--strong"
          type="text"
          value={object.title}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="Название"
          aria-label={`Название объекта ${index + 1}`}
          onChange={(event) => edit((item) => void (item.title = event.target.value))}
        />
        <textarea
          className="cell-input"
          rows={2}
          value={object.description}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="Описание"
          aria-label={`Описание объекта ${index + 1}`}
          onChange={(event) => edit((item) => void (item.description = event.target.value))}
        />
      </th>
      {groups.length > 0 && (
        <td>
          <select
            className="cell-input"
            aria-label={`Группа объекта ${index + 1}`}
            value={object.group ?? ''}
            onChange={(event) =>
              edit((item) => {
                if (event.target.value) item.group = event.target.value;
                else delete item.group;
              })
            }
          >
            <option value="">Без группы</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.title || 'Без названия'}
              </option>
            ))}
          </select>
        </td>
      )}
      {attributes.map((attribute) => (
        <td key={attribute.id} className="matrix__cell">
          <ScaleSelect
            value={level(object, attribute.id)}
            min={VALUE_RANGE.min}
            max={VALUE_RANGE.max}
            tone={`lvl--${level(object, attribute.id)}`}
            label={`${object.title || `Объект ${index + 1}`}: ${attribute.title}`}
            onChange={(value) => edit((item) => void (item.values[attribute.id] = value))}
          />
        </td>
      ))}
      <td>
        <RowActions
          label={object.title || `объект ${index + 1}`}
          onUp={index > 0 ? () => update((draft) => moveItem(draft.objects, index, -1)) : undefined}
          onDown={!isLast ? () => update((draft) => moveItem(draft.objects, index, 1)) : undefined}
          onRemove={remove}
        />
      </td>
    </tr>
  );
});
