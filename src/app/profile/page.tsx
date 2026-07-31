import { ThemeToggle } from "@/components/ThemeToggle";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <h1 className="font-display text-lg font-bold text-ink">Profile & settings</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Account information, staff and payroll, fees and discounts, and user
          roles will live here. This screen is being built.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="font-display text-base font-bold text-ink">Appearance</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Choose how Bursar looks on this device.
        </p>
        <div className="mt-4">
          <ThemeToggle />
        </div>
      </section>
    </div>
  );
}
