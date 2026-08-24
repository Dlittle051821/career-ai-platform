import { Sparkle } from "lucide-react";
import { Container } from "@/components/layout/Container";

export function AnnouncementStrip() {
  return (
    <div className="border-b border-white/10 bg-primary-dark">
      <Container className="flex items-center justify-center gap-2 py-2.5 text-center text-xs font-medium text-on-primary-muted sm:text-sm">
        <Sparkle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-accent" />
        Career-first guidance for students and families in Odisha — India and international pathways.
      </Container>
    </div>
  );
}
