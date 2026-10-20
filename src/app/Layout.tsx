import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { PendingSyncBadge } from './PendingSyncBadge';
import { UpdatePrompt } from './UpdatePrompt';
import styles from './Layout.module.css';

const NAV_ITEMS = [
  { to: '/', key: 'nav.today', end: true },
  { to: '/games', key: 'nav.games', end: false },
  { to: '/progress', key: 'nav.progress', end: false },
  { to: '/settings', key: 'nav.settings', end: false },
] as const;

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isPlaying = pathname.startsWith('/play/');

  return (
    <div className={styles.shell}>
      <UpdatePrompt />
      {!isPlaying && (
        <header className={styles.header}>
          <Link to="/" className={styles.brand}>
            {t('app.name')}
          </Link>
          <span className={styles.tagline}>{t('app.tagline')}</span>
          <PendingSyncBadge />
        </header>
      )}
      <main className={isPlaying ? styles.mainFull : styles.main}>
        <Outlet />
      </main>
      {!isPlaying && (
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={styles.navLink}>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
