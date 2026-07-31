"use client";

import { useTheme, type Theme } from "@/lib/theme";
import { MoonIcon, SunIcon } from "@/components/icons";
import { cn } from "@/components/ui";

const OPTIONS: { value: Theme; label: string; icon: typeof SunIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

/** Segmented light / dark switch for the Appearance panel. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-sunken p-0.5">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTheme(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition",
              active
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:text-ink",
            )}
          >
            <Icon width={16} height={16} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
