import { useBase } from '../base.ts';
import { useConfirm } from '../components/ConfirmDialog.tsx';
import type { Attribute } from '../engine/types.ts';
import { IMPORTANCE_MAX } from '../engine/validate.ts';
import { plural } from '../plural.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { IssueList, NumberField, RowActions, SectionHead, TextField } from './fields.tsx';
import { addAttribute, attributeUsage, moveItem, removeAttribute } from './ops.ts';

export function AttributesSection({ update }: { update: UpdateBase }) {
  const confirm = useConfirm();
  const { base, issues } = useBase();

  const edit = (id: string, change: (attribute: Attribute) => void) =>
    update((draft) => {
      const attribute = draft.attributes.find((item) => item.id === id);
      if (attribute) change(attribute);
    });

  async function remove(attribute: Attribute) {
    const usage = attributeUsage(base, attribute.id);
    const lost = [
      usage.values > 0 && plural(usage.values, ['значение у объектов', 'значения у объектов', 'значений у объектов']),
      usage.weights > 0 && plural(usage.weights, ['вариант ответа с весом', 'варианта ответа с весом', 'вариантов ответа с весом']),
      ...usage.groups.map((group) => `группа «${group.title}»`),
    ].filter(Boolean);
    const yes = await confirm({
      title: `Удалить атрибут «${attribute.title || 'без названия'}»?`,
      message: lost.length > 0 ? `Вместе с ним пропадут: ${lost.join(', ')}.` : undefined,
      action: 'Удалить',
    });
    if (yes) update((draft) => removeAttribute(draft, attribute.id));
  }

  return (
    <section>
      <SectionHead title="Атрибуты">
        Свойства, по которым система сравнивает ответы человека с объектами. Важность — вес атрибута при сравнении: атрибут с важностью 2 влияет
        на рейтинг сильнее, чем с важностью 1.
      </SectionHead>
      <IssueList issues={issues.filter((issue) => issue.section === 'attributes')} />

      <ul className="editor-list">
        {base.attributes.map((attribute, index) => {
          const group = base.groups.find((item) => item.attribute === attribute.id);
          return (
            <li key={attribute.id} id={`entity-${attribute.id}`} className="editor-card">
              <div className="editor-card__head">
                <span className="params__number">{index + 1}</span>
                <span className="editor-card__title">{attribute.title || 'Новый атрибут'}</span>
                {group && <span className="badge badge--outline">Группа «{group.title}»</span>}
                <RowActions
                  label={attribute.title || `атрибут ${index + 1}`}
                  onUp={index > 0 ? () => update((draft) => moveItem(draft.attributes, index, -1)) : undefined}
                  onDown={index < base.attributes.length - 1 ? () => update((draft) => moveItem(draft.attributes, index, 1)) : undefined}
                  onRemove={() => remove(attribute)}
                />
              </div>
              <div className="form-grid form-grid--attribute">
                <TextField label="Название" value={attribute.title} onChange={(value) => edit(attribute.id, (item) => void (item.title = value))} />
                <TextField
                  label="Короткое название"
                  hint="Для таблиц. Если пусто, показывается полное."
                  value={attribute.short}
                  onChange={(value) => edit(attribute.id, (item) => void (item.short = value))}
                />
                <NumberField
                  label="Важность"
                  value={attribute.importance}
                  check={(value) => value >= 0 && value <= IMPORTANCE_MAX}
                  errorText={`Нужно число от 0 до ${IMPORTANCE_MAX}.`}
                  onChange={(value) => edit(attribute.id, (item) => void (item.importance = value))}
                />
                <TextField
                  label="Что означает шкала 0–3"
                  className="form-grid__wide"
                  value={attribute.description}
                  placeholder="0 — совсем нет, 3 — выражено сильно"
                  onChange={(value) => edit(attribute.id, (item) => void (item.description = value))}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <button type="button" className="btn btn--secondary btn--small" onClick={() => update((draft) => void addAttribute(draft))}>
          Добавить атрибут
        </button>
      </div>
    </section>
  );
}
