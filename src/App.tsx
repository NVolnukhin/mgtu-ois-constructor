import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { BaseContext, compileBase, testPath } from './base.ts';
import { BaseLayout } from './components/BaseLayout.tsx';
import { ChecksScreen } from './components/ChecksScreen.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { HelpScreen } from './components/HelpScreen.tsx';
import { HomeScreen } from './components/HomeScreen.tsx';
import { SaveToast } from './components/SaveToast.tsx';
import { SessionScreens } from './components/SessionScreens.tsx';
import { EditorScreen } from './editor/EditorScreen.tsx';
import { HELP_PATH, HOME_PATH, useRoute } from './router.ts';
import type { BaseSection } from './router.ts';
import { StorageBanner } from './components/StorageBanner.tsx';
import { exampleRecord, EXAMPLE_ID, loadSession, useStore } from './storage.ts';

export function App() {
  const route = useRoute();
  const place =
    route.name === 'base' ? `${route.id}/${route.section}/${route.tab ?? ''}` : route.name === 'help' ? `help/${route.topic ?? ''}` : 'home';
  // К разделу инструкции страницу прокручивает сама инструкция.
  const toTop = !(route.name === 'help' && route.topic);

  // Сменился экран — прокручиваем страницу наверх.
  useEffect(() => {
    if (toTop) window.scrollTo({ top: 0 });
  }, [place, toTop]);

  return (
    <>
      <ErrorBoundary resetKey={place}>
        {route.name === 'home' && (
          <SiteLayout title="Конструктор экспертных систем" wide>
            <HomeScreen />
          </SiteLayout>
        )}
        {route.name === 'help' && (
          <SiteLayout title="Инструкция — Конструктор экспертных систем" current="help">
            <HelpScreen topic={route.topic} />
          </SiteLayout>
        )}
        {route.name === 'base' && <BaseRoute id={route.id} section={route.section} tab={route.tab} />}
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

interface SiteLayoutProps {
  title: string;
  /** Экран шире обычного. */
  wide?: boolean;
  /** Открыта инструкция: ссылка на неё в шапке отмечена как текущая. */
  current?: 'help';
  children: ReactNode;
}

/** Каркас главной и инструкции: шапка со ссылкой на инструкцию и подвал. */
function SiteLayout({ title, wide = false, current, children }: SiteLayoutProps) {
  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="app">
      <header className="topbar">
        <Brand title="Конструктор экспертных систем" />
        <a
          className={current === 'help' ? 'topbar__link topbar__link--active' : 'topbar__link'}
          aria-current={current === 'help' ? 'page' : undefined}
          href={HELP_PATH}
        >
          Инструкция
        </a>
      </header>
      <StorageBanner />
      <main className={wide ? 'main main--wide' : 'main'}>{children}</main>
      <footer className="footer">
        <p>Автор конструктора: Волнухин Никита</p>
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

  if (!record || !compiled) return <BaseNotFound id={id} />;
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

function BaseNotFound({ id }: { id: string }) {
  const { broken } = useStore();
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
          {broken.includes(id)
            ? 'Запись этой базы есть в браузере, но прочитать её не удалось. На главной её можно скачать как есть или удалить.'
            : 'В этом браузере такой базы нет. Возможно, её удалили, или ссылку открыли в другом браузере: базы хранятся только там, где их создали. Чтобы передать базу, скачайте её файлом JSON и импортируйте на главной.'}
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
