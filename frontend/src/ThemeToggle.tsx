import { useTheme } from './hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="
        inline-flex items-center gap-2 rounded-xl px-3 py-2
        border border-zinc-200/70 dark:border-zinc-800/70
        bg-white/70 dark:bg-zinc-900/70
        hover:border-emerald-400/50 transition
        text-sm
      "
      aria-label="Toggle theme"
      title="Toggle light/dark"
    >
      <span className="h-4 w-4">
        {isDark ? '🌙' : '☀️'}
      </span>
      <span>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
