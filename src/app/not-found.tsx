import { Compass } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Section tone="default" className="py-24 text-center sm:py-32">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary-light text-secondary-dark">
        <Compass aria-hidden="true" className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold text-primary sm:text-4xl">We couldn&apos;t find that page</h1>
      <p className="mx-auto mt-4 max-w-md text-base text-muted">
        The page you&apos;re looking for may have moved or doesn&apos;t exist. Let&apos;s get you back on track.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
        <LinkButton href="/">Go to homepage</LinkButton>
        <LinkButton href="/book-counselling" variant="outline">
          Book free counselling
        </LinkButton>
      </div>
    </Section>
  );
}
