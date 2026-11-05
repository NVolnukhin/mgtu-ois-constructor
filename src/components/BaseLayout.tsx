import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useBase } from '../base.ts';
import { basePath, HOME_PATH } from '../router.ts';
import type { BaseSection } from '../router.ts';
import { baseImages } from '../engine/images.ts';

const NAV: { section: BaseSection; title: string }[] = [
  { section: 'kb', title: 'База знаний' },
  { section: 'wm', title: 'Рабочая БД' },
  { section: 'checks', title: 'Проверка' },
  { section: 'edit', title: 'Редактор' },
];

interface BaseLayoutProps {
  section: BaseSection;
  /** Куда ведёт пункт «Тест»: к результату, текущему вопросу или стартовому экрану. */
  returnPath: string;
  /** Экран шире обычного. */
  wide?: boolean;
  children: ReactNode;
}

/** Каркас экранов выбранной базы: шапка с разделами и подвал. */
export function BaseLayout({ section, returnPath, wide = true, children }: BaseLayoutProps) {
  const { id, base } = useBase();
  const [menuOpen, setMenuOpen] = useState(false);
  const inTest = section === 'start' || section === 'test' || section === 'result';
  const hasCredits = baseImages(base).some(({ image }) => image.credit);

  useEffect(() => {
    document.title = base.title || 'Без названия';
  }, [base.title]);

  // Сменился экран — закрываем меню.
  useEffect(() => {
    setMenuOpen(false);
  }, [section]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const linkClass = (active: boolean) => (active ? 'topnav__link topnav__link--active' : 'topnav__link');

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__left">
          <a className="brand" href={HOME_PATH} aria-label="Все базы">
            <img className="brand__icon" src="favicon.svg" alt="" width={28} height={28} />
            <span className="brand__name brand__name--wide">Все базы</span>
          </a>
          <span className="topbar__sep" aria-hidden="true">
            /
          </span>
          <a className="topbar__base" href={basePath(id)} title={base.title}>
            {base.title || 'Без названия'}
          </a>
        </div>
        <nav className="topnav" aria-label="Разделы базы">
          <button
            type="button"
            className="topnav__menu"
            aria-expanded={menuOpen}
            aria-controls="topnav-links"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span className="topnav__menu-icon" aria-hidden="true" />
            <span className="visually-hidden">Меню</span>
          </button>
          <div id="topnav-links" className={menuOpen ? 'topnav__links topnav__links--open' : 'topnav__links'}>
            <a className={linkClass(inTest)} aria-current={inTest ? 'page' : undefined} href={returnPath}>
              Тест
            </a>
            {NAV.map((item) => (
              <a
                key={item.section}
                className={linkClass(section === item.section)}
                aria-current={section === item.section ? 'page' : undefined}
                href={basePath(id, item.section)}
              >
                {item.title}
              </a>
            ))}
          </div>
        </nav>
      </header>

      {/* key: при смене экрана содержимое монтируется заново и плавно появляется */}
      <main key={section} className={wide ? 'main main--wide' : 'main'}>
        {children}
      </main>

      <footer className="footer">
        <p>{base.author ? `Автор базы: ${base.author}` : 'Конструктор экспертных систем'}</p>
        {hasCredits && (
          <a className="footer__link" href={basePath(id, 'credits')}>
            Фото: авторы и лицензии
          </a>
        )}
      </footer>
    </div>
  );
}
