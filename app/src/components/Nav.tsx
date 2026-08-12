import { useStore, type Route } from '@/lib/store';
import { useT } from '@/lib/i18n';

/** Neeche ka nav — user seedha kahin bhi ja sake. */
const TABS: { route: Route; emoji: string; label: [string, string] }[] = [
  { route: 'home', emoji: '🏠', label: ['Home', 'Home'] },
  { route: 'plan', emoji: '🎯', label: ['Coach', 'Coach'] },
  { route: 'advice', emoji: '💡', label: ['Advice', 'Salah'] },
  { route: 'book', emoji: '📒', label: ['Book', 'Book'] },
  { route: 'report', emoji: '📊', label: ['Report', 'Report'] },
];

export function NavBar() {
  const t = useT();
  const { route, setRoute } = useStore();
  return (
    <nav className="navbar">
      {TABS.map((tab) => (
        <button key={tab.route} className="nav-item" data-on={route === tab.route} onClick={() => setRoute(tab.route)}>
          <span className="ni-emoji">{tab.emoji}</span>
          <span className="ni-label">{t(...tab.label)}</span>
        </button>
      ))}
    </nav>
  );
}
