"use client";

import { useId, useState } from "react";
import { Mail } from "lucide-react";
import { CONTACT_PEOPLE } from "@/config/contact";
import { buttonClasses } from "@/components/ui/Button";
import { CONTACT_PURPOSES } from "@/data/contact";

/**
 * CIUX-01 — replaces the Milestone 1 demo form, which validated input but
 * sent nothing (a misleading success state on a production page). This
 * composer is honest: it builds a mailto: link to the chosen founder with
 * the topic as the subject, and opens the visitor's own email app. Nothing
 * is sent or stored by Nextwise, and the page never claims a message was
 * delivered.
 */
export function ContactEmailComposer() {
  const [to, setTo] = useState(CONTACT_PEOPLE[0].email);
  const [topic, setTopic] = useState(CONTACT_PURPOSES[0].title);
  const toId = useId();
  const topicId = useId();
  const href = `mailto:${to}?subject=${encodeURIComponent(`${topic} — Nextwise`)}`;

  return (
    <div className="rounded-[var(--radius-card)] border border-primary/10 bg-surface p-6 shadow-soft sm:p-8">
      <h3 className="text-xl">Write to us</h3>
      <p className="mt-2 text-[15px] text-muted">
        Choose who to write to and what it is about. We open your own email app with the address and subject filled in;
        your message is sent from there, not from this page.
      </p>
      <div className="mt-6 grid gap-5">
        <div>
          <label htmlFor={toId} className="text-sm font-semibold text-primary">
            Write to
          </label>
          <select
            id={toId}
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-2 block min-h-[48px] w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[15px] text-text"
          >
            {CONTACT_PEOPLE.map((p) => (
              <option key={p.email} value={p.email}>
                {p.role} — {p.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={topicId} className="text-sm font-semibold text-primary">
            Topic
          </label>
          <select
            id={topicId}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-2 block min-h-[48px] w-full rounded-[var(--radius-control)] border border-border-strong bg-surface px-3 text-[15px] text-text"
          >
            {CONTACT_PURPOSES.map((p) => (
              <option key={p.title} value={p.title}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      <a href={href} className={buttonClasses("secondary", "md", "mt-6")}>
        <Mail aria-hidden="true" className="h-4 w-4" />
        Open in your email app
      </a>
      <p className="mt-3 text-[13px] text-muted">
        No email app? Write to <span className="font-medium text-text">{to}</span> from any email account.
      </p>
    </div>
  );
}
