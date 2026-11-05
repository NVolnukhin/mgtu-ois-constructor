import { useBase } from '../base.ts';
import { useConfirm } from '../components/ConfirmDialog.tsx';
import type { Group } from '../engine/types.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { ImageField, IssueList, ListField, RowActions, SectionHead, SelectField, TextField } from './fields.tsx';
import { addGroup, moveItem, profilesExpectingGroup, profilesPhrase, removeGroup } from './ops.ts';

export function GroupsSection({ update }: { update: UpdateBase }) {
  const confirm = useConfirm();
  const { base, issues } = useBase();

  const edit = (id: string, change: (group: Group) => void) =>
    update((draft) => {
      const group = draft.groups.find((item) => item.id === id);
      if (group) change(group);
    });

  async function remove(group: Group) {
    const profiles = profilesExpectingGroup(base, group.id);
    const yes = await confirm({
      title: `Удалить группу «${group.title || 'без названия'}»?`,
      message:
        'Объекты и блоки останутся без группы, связанный атрибут останется в базе.' +
        (profiles.length > 0 ? ` Ожидания о ней пропадут из ${profilesPhrase(profiles)}.` : ''),
      action: 'Удалить',
    });
    if (yes) update((draft) => removeGroup(draft, group.id));
  }

  return (
    <section>
      <SectionHead title="Группы">
        Необязательны. Без групп система показывает только рейтинг объектов. С группами в конце теста появляется итог вроде «направленности»:
        группа связана с атрибутом, а её результат — доля баллов этого атрибута от возможного максимума.
      </SectionHead>

      <ul className="editor-list">
        {base.groups.map((group, index) => {
          // Атрибут связан с одной группой: занятые другими группами в списке не показываем.
          const free = base.attributes.filter((attribute) => attribute.id === group.attribute || !base.groups.some((other) => other.attribute === attribute.id));
          return (
            <li key={group.id} id={`entity-${group.id}`} className="editor-card">
              <div className="editor-card__head">
                <span className="params__number">{index + 1}</span>
                <span className="editor-card__title">{group.title || 'Новая группа'}</span>
                <RowActions
                  label={group.title || `группа ${index + 1}`}
                  onUp={index > 0 ? () => update((draft) => moveItem(draft.groups, index, -1)) : undefined}
                  onDown={index < base.groups.length - 1 ? () => update((draft) => moveItem(draft.groups, index, 1)) : undefined}
                  onRemove={() => remove(group)}
                />
              </div>
              <div className="form-grid">
                <TextField label="Название" value={group.title} onChange={(value) => edit(group.id, (item) => void (item.title = value))} />
                <SelectField
                  label="Связанный атрибут"
                  hint="Итог группы — доля баллов этого атрибута."
                  value={group.attribute}
                  options={free.map((attribute) => ({ value: attribute.id, label: attribute.title || 'Без названия' }))}
                  onChange={(value) => edit(group.id, (item) => void (item.attribute = value))}
                />
                <TextField
                  label="Короткий девиз"
                  className="form-grid__wide"
                  value={group.tagline ?? ''}
                  onChange={(value) =>
                    edit(group.id, (item) => {
                      if (value) item.tagline = value;
                      else delete item.tagline;
                    })
                  }
                />
                <TextField
                  label="Описание"
                  className="form-grid__wide"
                  multiline
                  value={group.description}
                  onChange={(value) => edit(group.id, (item) => void (item.description = value))}
                />
                <ListField
                  label="Что пригодится"
                  hint="Каждый пункт с новой строки."
                  value={group.qualities ?? []}
                  onChange={(value) =>
                    edit(group.id, (item) => {
                      if (value.length > 0) item.qualities = value;
                      else delete item.qualities;
                    })
                  }
                />
                <ListField
                  label="С чего начать"
                  hint="Каждый шаг с новой строки."
                  value={group.firstSteps ?? []}
                  onChange={(value) =>
                    edit(group.id, (item) => {
                      if (value.length > 0) item.firstSteps = value;
                      else delete item.firstSteps;
                    })
                  }
                />
              </div>
              <ImageField
                label="Картинка"
                image={group.image}
                onChange={(image) =>
                  edit(group.id, (item) => {
                    if (image) item.image = image;
                    else delete item.image;
                  })
                }
              />
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <button type="button" className="btn btn--secondary btn--small" onClick={() => update((draft) => void addGroup(draft))}>
          Добавить группу
        </button>
      </div>
      <IssueList issues={issues.filter((issue) => issue.section === 'groups')} />
    </section>
  );
}
