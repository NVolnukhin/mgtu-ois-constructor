import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { baseTitle, useBase } from '../base.ts';
import { basePath, HOME_PATH } from '../router.ts';
import type { BaseSection } from '../router.ts';
import { baseImages } from '../engine/images.ts';
import { StorageBanner } from './StorageBanner.tsx';

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
  const navRef = useRef<HTMLElement>(null);
  const title = baseTitle(base);
  const inTest = section === 'start' || section === 'test' || section === 'result';
  const hasCredits = baseImages(base).some(({ image }) => image.credit);

  useEffect(() => {
    document.title = title;
  }, [title]);

  // Сменился экран — закрываем меню.
  useEffect(() => {
    setMenuOpen(false);
  }, [section]);

  // Открытое меню закрывает часть экрана, поэтому закрывается любым действием мимо него.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      navRef.current?.querySelector<HTMLElement>('.topnav__menu')?.focus();
    };
    const closeOutside = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener('keydown', closeOnEscape);
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('scroll', close, { passive: true });
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('scroll', close);
    };
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
          <a className="topbar__base" href={basePath(id)} title={title}>
            {title}
          </a>
        </div>
        <nav ref={navRef} className="topnav" aria-label="Разделы базы">
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
          {/* Нажатие на пункт текущего раздела экран не меняет, но меню тоже должно закрыть. */}
          <div id="topnav-links" className={menuOpen ? 'topnav__links topnav__links--open' : 'topnav__links'} onClick={() => setMenuOpen(false)}>
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
      <StorageBanner />

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
