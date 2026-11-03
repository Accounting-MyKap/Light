import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { GamesIcon, ProgressIcon, SettingsIcon, TodayIcon } from './NavIcons';
import { UpdatePrompt } from './UpdatePrompt';
import styles from './Layout.module.css';

const NAV_ITEMS = [
  { to: '/', key: 'nav.today', end: true, Icon: TodayIcon },
  { to: '/games', key: 'nav.games', end: false, Icon: GamesIcon },
  { to: '/progress', key: 'nav.progress', end: false, Icon: ProgressIcon },
  { to: '/settings', key: 'nav.settings', end: false, Icon: SettingsIcon },
] as const;

export function Layout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isPlaying = pathname.startsWith('/play/');

  return (
    <div className={styles.shell}>
      <UpdatePrompt />
      <main className={isPlaying ? styles.mainFull : styles.main}>
        <Outlet />
      </main>
      {!isPlaying && (
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={styles.navLink}>
              <item.Icon />
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
