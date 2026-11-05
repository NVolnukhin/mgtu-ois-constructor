import { useBase } from '../base.ts';
import { useConfirm } from '../components/ConfirmDialog.tsx';
import { attributeLabel, level } from '../engine/scoring.ts';
import type { RankedObject } from '../engine/types.ts';
import { VALUE_RANGE } from '../engine/validate.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { IssueList, RowActions, ScaleSelect, SectionHead } from './fields.tsx';
import { addObject, moveItem, removeObject } from './ops.ts';

export function ObjectsSection({ update }: { update: UpdateBase }) {
  const confirm = useConfirm();
  const { base, issues } = useBase();
  const hasGroups = base.groups.length > 0;

  const edit = (id: string, change: (object: RankedObject) => void) =>
    update((draft) => {
      const object = draft.objects.find((item) => item.id === id);
      if (object) change(object);
    });

  async function remove(object: RankedObject) {
    const yes = await confirm({ title: `Удалить объект «${object.title || 'без названия'}»?`, action: 'Удалить' });
    if (yes) update((draft) => removeObject(draft, object.id));
  }

  return (
    <section>
      <SectionHead title="Объекты">
        То, что система ранжирует. Число в ячейке — насколько у объекта выражен атрибут: {VALUE_RANGE.min} — нет, {VALUE_RANGE.max} — сильно.
      </SectionHead>
      <IssueList issues={issues.filter((issue) => issue.section === 'objects')} />

      {base.attributes.length === 0 && <p className="editor-empty">Сначала добавьте атрибуты: объекты описываются их значениями.</p>}

      {base.objects.length > 0 && (
        <div className="table-scroll">
          <table className="kb-table matrix">
            <thead>
              <tr>
                <th scope="col" className="matrix__sticky">
                  Объект и описание
                </th>
                {hasGroups && <th scope="col">Группа</th>}
                {base.attributes.map((attribute) => (
                  <th key={attribute.id} scope="col" className="kb-table__attr" title={attribute.title}>
                    {attributeLabel(attribute) || '—'}
                  </th>
                ))}
                <th scope="col">
                  <span className="visually-hidden">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {base.objects.map((object, index) => (
                <tr key={object.id} id={`entity-${object.id}`}>
                  <th scope="row" className="matrix__sticky matrix__name">
                    <input
                      className="cell-input cell-input--strong"
                      type="text"
                      value={object.title}
                      placeholder="Название"
                      aria-label={`Название объекта ${index + 1}`}
                      onChange={(event) => edit(object.id, (item) => void (item.title = event.target.value))}
                    />
                    <textarea
                      className="cell-input"
                      rows={2}
                      value={object.description}
                      placeholder="Описание"
                      aria-label={`Описание объекта ${index + 1}`}
                      onChange={(event) => edit(object.id, (item) => void (item.description = event.target.value))}
                    />
                  </th>
                  {hasGroups && (
                    <td>
                      <select
                        className="cell-input"
                        aria-label={`Группа объекта ${index + 1}`}
                        value={object.group ?? ''}
                        onChange={(event) =>
                          edit(object.id, (item) => {
                            if (event.target.value) item.group = event.target.value;
                            else delete item.group;
                          })
                        }
                      >
                        <option value="">Без группы</option>
                        {base.groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.title || group.id}
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  {base.attributes.map((attribute) => (
                    <td key={attribute.id} className="matrix__cell">
                      <ScaleSelect
                        value={level(object, attribute.id)}
                        min={VALUE_RANGE.min}
                        max={VALUE_RANGE.max}
                        tone={`lvl--${level(object, attribute.id)}`}
                        label={`${object.title || `Объект ${index + 1}`}: ${attribute.title}`}
                        onChange={(value) => edit(object.id, (item) => void (item.values[attribute.id] = value))}
                      />
                    </td>
                  ))}
                  <td>
                    <RowActions
                      label={object.title || `объект ${index + 1}`}
                      onUp={index > 0 ? () => update((draft) => moveItem(draft.objects, index, -1)) : undefined}
                      onDown={index < base.objects.length - 1 ? () => update((draft) => moveItem(draft.objects, index, 1)) : undefined}
                      onRemove={() => remove(object)}
                    />
                  </td>
                </tr>
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
    </section>
  );
}
