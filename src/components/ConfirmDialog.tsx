// Диалог подтверждения вместо системного window.confirm: выглядит как весь сайт, а кнопка называет действие.
// Это нативный <dialog>: браузер сам держит фокус внутри, закрывает его по Esc, делает страницу под ним
// недоступной и после закрытия возвращает фокус туда, откуда диалог открыли.

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

export interface ConfirmRequest {
  title: string;
  /** Что ещё произойдёт: что пропадёт вместе с удалённым, можно ли это вернуть. */
  message?: string;
  /** Подпись кнопки подтверждения: глагол, а не «ОК». */
  action: string;
}

type Confirm = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Спрашивает подтверждение: true — нажата кнопка действия, false — человек отказался любым способом. */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm вызван вне ConfirmProvider');
  return confirm;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ request: ConfirmRequest; answer: (yes: boolean) => void } | null>(null);
  const confirm = useCallback<Confirm>((request) => new Promise((answer) => setOpen({ request, answer })), []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {open && (
        <ConfirmDialog
          request={open.request}
          onAnswer={(yes) => {
            // Запоздалое событие старого диалога не должно закрыть уже открытый новый.
            setOpen((current) => (current === open ? null : current));
            open.answer(yes);
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

function ConfirmDialog({ request, onAnswer }: { request: ConfirmRequest; onAnswer: (yes: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // Действие обычно необратимое, поэтому случайный Enter должен отменять, а не подтверждать.
    cancelRef.current?.focus();
  }, []);

  // Отвечаем сразу, не дожидаясь события close: браузер присылает его с задержкой, и следующий диалог,
  // открытый за это время, не показался бы.
  function answer(yes: boolean) {
    dialogRef.current?.close();
    onAnswer(yes);
  }

  function closeOnBackdrop(event: MouseEvent<HTMLDialogElement>) {
    // Клик по затемнению приходит на сам <dialog>: всё содержимое лежит внутри .confirm__box.
    if (event.target === dialogRef.current) answer(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm"
      aria-labelledby={titleId}
      aria-describedby={request.message ? textId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        answer(false);
      }}
      onClose={() => onAnswer(false)}
      onClick={closeOnBackdrop}
    >
      <div className="confirm__box">
        <h2 id={titleId} className="confirm__title">
          {request.title}
        </h2>
        {request.message && (
          <p id={textId} className="confirm__text">
            {request.message}
          </p>
        )}
        <div className="confirm__actions">
          <button ref={cancelRef} type="button" className="btn btn--secondary" onClick={() => answer(false)}>
            Отмена
          </button>
          <button type="button" className="btn btn--primary" onClick={() => answer(true)}>
            {request.action}
          </button>
        </div>
      </div>
    </dialog>
  );
}
