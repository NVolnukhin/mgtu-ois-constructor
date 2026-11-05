import { useBase } from '../base.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { IssueList, NumberField, SectionHead, TextField } from './fields.tsx';

export function SettingsSection({ update }: { update: UpdateBase }) {
  const { base, issues } = useBase();
  const { settings } = base;
  return (
    <section>
      <SectionHead title="Настройки">Формула вывода одна на все базы, а эти значения у каждой базы свои.</SectionHead>
      <div className="form-grid">
        <NumberField
          label="Сколько лучших объектов показывать"
          hint="После каждого ответа. Весь рейтинг открывается по кнопке."
          value={settings.topCount}
          check={(value) => Number.isInteger(value) && value >= 1}
          errorText="Нужно целое число от 1."
          onChange={(value) => update((draft) => void (draft.settings.topCount = value))}
        />
        <NumberField
          label="Порог близких результатов, п. п."
          hint="Если вторая группа отстаёт меньше чем на столько, показываются обе."
          value={settings.closeGap}
          check={(value) => value >= 0}
          errorText="Нужно число от 0."
          onChange={(value) => update((draft) => void (draft.settings.closeGap = value))}
        />
        <NumberField
          label="Порог слабого итога, %"
          hint="Если даже лучшая группа набрала меньше, итог помечается как слабо выраженный."
          value={settings.weakPercent}
          check={(value) => value >= 0 && value <= 100}
          errorText="Нужно число от 0 до 100."
          onChange={(value) => update((draft) => void (draft.settings.weakPercent = value))}
        />
        <TextField
          label="Как называть группы"
          placeholder="Группы"
          hint="Например, «Направления»."
          value={settings.groupsTitle ?? ''}
          onChange={(value) =>
            update((draft) => {
              if (value) draft.settings.groupsTitle = value;
              else delete draft.settings.groupsTitle;
            })
          }
        />
        <TextField
          label="Как называть итог"
          placeholder="Результат"
          hint="Подпись над итогом, например «Твоя направленность»."
          value={settings.resultTitle ?? ''}
          onChange={(value) =>
            update((draft) => {
              if (value) draft.settings.resultTitle = value;
              else delete draft.settings.resultTitle;
            })
          }
        />
      </div>
      <IssueList issues={issues.filter((issue) => issue.section === 'settings')} />
    </section>
  );
}
