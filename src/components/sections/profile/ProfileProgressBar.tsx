import { cn } from "@/lib/utils";

interface ProfileProgressBarProps {
  percent: number;
  className?: string;
  trackClassName?: string;
}

/** Shared progress bar — used on the dashboard card, /profile, and the onboarding wizard header. */
export function ProfileProgressBar({ percent, className, trackClassName }: ProfileProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Profile completion"
      className={cn("h-2 overflow-hidden rounded-full bg-surface-alt", trackClassName, className)}
    >
      <div className="h-full rounded-full bg-secondary transition-all duration-300" style={{ width: `${clamped}%` }} />
    </div>
  );
}
