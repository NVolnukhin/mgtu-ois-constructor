import { useBase } from '../base.ts';
import type { UpdateBase } from './EditorScreen.tsx';
import { ImageField, IssueList, SectionHead, TextField } from './fields.tsx';

export function GeneralSection({ update }: { update: UpdateBase }) {
  const { base, issues } = useBase();
  return (
    <section>
      <SectionHead title="Основное">Что видит человек на стартовом экране теста.</SectionHead>
      <IssueList issues={issues.filter((issue) => issue.section === 'general')} />
      <div className="form-stack">
        <TextField label="Название" value={base.title} onChange={(value) => update((draft) => void (draft.title = value))} />
        <TextField
          label="Подзаголовок"
          value={base.subtitle}
          placeholder="Онлайн-тест"
          onChange={(value) => update((draft) => void (draft.subtitle = value))}
        />
        <TextField label="Описание" multiline value={base.description} onChange={(value) => update((draft) => void (draft.description = value))} />
        <TextField label="Автор" value={base.author} onChange={(value) => update((draft) => void (draft.author = value))} />
        <ImageField
          label="Обложка"
          image={base.image}
          onChange={(image) =>
            update((draft) => {
              if (image) draft.image = image;
              else delete draft.image;
            })
          }
        />
        <TextField
          label="Примечание об источниках картинок"
          hint="Показывается на экране с авторами и лицензиями."
          value={base.imagesNote ?? ''}
          onChange={(value) =>
            update((draft) => {
              if (value) draft.imagesNote = value;
              else delete draft.imagesNote;
            })
          }
        />
      </div>
    </section>
  );
}
