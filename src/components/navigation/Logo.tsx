import Link from "next/link";
import { Compass } from "lucide-react";
import { BRAND_NAME } from "@/config/site";

export function Logo({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md py-1 text-lg font-semibold tracking-tight"
      aria-label={`${BRAND_NAME} — home`}
    >
      <span
        className={
          onDark
            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-on-primary"
            : "flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-on-primary"
        }
      >
        <Compass aria-hidden="true" className="h-5 w-5" />
      </span>
      <span className={onDark ? "text-on-primary" : "text-primary"}>{BRAND_NAME}</span>
    </Link>
  );
}
