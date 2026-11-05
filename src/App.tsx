import { useEffect, useMemo } from 'react';
import { BaseContext, compileBase, testPath } from './base.ts';
import { BaseLayout } from './components/BaseLayout.tsx';
import { ChecksScreen } from './components/ChecksScreen.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { HomeScreen } from './components/HomeScreen.tsx';
import { SaveToast } from './components/SaveToast.tsx';
import { SessionScreens } from './components/SessionScreens.tsx';
import { EditorScreen } from './editor/EditorScreen.tsx';
import { HOME_PATH, useRoute } from './router.ts';
import type { BaseSection } from './router.ts';
import { exampleRecord, EXAMPLE_ID, loadSession, useStore } from './storage.ts';
import type { StorageProblem } from './storage.ts';

const PROBLEM_TEXT: Record<StorageProblem, string> = {
  quota:
    'Не удалось сохранить: в хранилище браузера закончилось место. Изменения пока есть только в этой вкладке. Скачайте базу в JSON или удалите ненужные базы, и сохранение повторится.',
  unavailable:
    'Браузер не даёт сохранять данные (так бывает в приватном режиме). Изменения есть только в этой вкладке и пропадут при её закрытии: скачайте базу в JSON.',
};

export function App() {
  const route = useRoute();
  const { problem } = useStore();
  const place = route.name === 'home' ? 'home' : `${route.id}/${route.section}/${route.tab ?? ''}`;

  // Сменился экран — прокручиваем страницу наверх.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [place]);

  return (
    <>
      {problem && (
        <p className="banner" role="alert">
          {PROBLEM_TEXT[problem]}
        </p>
      )}
      <ErrorBoundary resetKey={place}>
        {route.name === 'home' ? <HomeLayout /> : <BaseRoute id={route.id} section={route.section} tab={route.tab} />}
      </ErrorBoundary>
      <SaveToast />
    </>
  );
}

function Brand({ title }: { title: string }) {
  return (
    <a className="brand" href={HOME_PATH}>
      <img className="brand__icon" src="favicon.svg" alt="" width={28} height={28} />
      <span className="brand__name">{title}</span>
    </a>
  );
}

function HomeLayout() {
  useEffect(() => {
    document.title = 'Конструктор экспертных систем';
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <Brand title="Конструктор экспертных систем" />
      </header>
      <main className="main main--wide">
        <HomeScreen />
      </main>
      <footer className="footer">
        <p>Сервера нет: базы и ответы остаются в этом браузере.</p>
        <a className="footer__link" href="https://github.com/NVolnukhin/mgtu-ois-constructor" target="_blank" rel="noreferrer">
          Исходный код
        </a>
      </footer>
    </div>
  );
}

interface BaseRouteProps {
  id: string;
  section: BaseSection;
  tab?: string;
}

/** Экраны выбранной базы. База берётся из хранилища, поэтому изменения в редакторе видны сразу. */
function BaseRoute({ id, section, tab }: BaseRouteProps) {
  const { records } = useStore();
  const record = id === EXAMPLE_ID ? exampleRecord : records.find((item) => item.id === id);
  const compiled = useMemo(() => (record ? compileBase(record) : null), [record]);

  if (!record || !compiled) return <BaseNotFound />;
  return (
    <BaseContext.Provider value={compiled}>
      {/* key: при любом изменении базы ход теста читается заново, номер вопроса приводится к допустимому. */}
      {isSessionSection(section) ? (
        <SessionScreens key={record.updatedAt} section={section} />
      ) : (
        <BaseLayout section={section} returnPath={testPath(compiled, loadSession(compiled.id)?.answers)}>
          {section === 'edit' ? <EditorScreen tab={tab} /> : <ChecksScreen />}
        </BaseLayout>
      )}
    </BaseContext.Provider>
  );
}

function isSessionSection(section: BaseSection): boolean {
  return section !== 'edit' && section !== 'checks';
}

function BaseNotFound() {
  useEffect(() => {
    document.title = 'База не найдена';
  }, []);
  return (
    <div className="app">
      <header className="topbar">
        <Brand title="Конструктор экспертных систем" />
      </header>
      <main className="main">
        <h1 className="page__title">База не найдена</h1>
        <p className="page__lead">
          Базы хранятся только в браузере, где их создали, поэтому ссылка из другого браузера здесь не откроется. Чтобы передать
          базу, скачайте её файлом JSON и импортируйте на главной.
        </p>
        <div className="actions">
          <a className="btn btn--primary" href={HOME_PATH}>
            На главную
          </a>
        </div>
      </main>
    </div>
  );
}
