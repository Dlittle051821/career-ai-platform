"use client";

import { useId, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Sparkles, X } from "lucide-react";
import { DEFAULT_SALARY_COUNTRY_CODES, GEMINI_APP_URL, SALARY_COUNTRIES, buildSalaryPrompt, resolveSalaryCountries } from "@/lib/career-explorer/gemini";

type CopyState = "idle" | "copied" | "manual";

/**
 * "Research Salaries with Gemini" — the approved V5 handoff.
 *
 * What really happens: the student picks countries, sees the prepared
 * question, and one button copies it and opens Gemini in a new tab. They
 * paste and send it there themselves. Nextwise does not send the question,
 * does not receive an answer and shows no salary figure of its own. The
 * second tab is a labelled concept of a possible future view and contains
 * placeholder shapes only — no numbers.
 *
 * Only the career title and the chosen countries go into the question.
 */
export function SalaryResearch({ careerTitle, variant = "button" }: { careerTitle: string; variant?: "button" | "link" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [tab, setTab] = useState<"question" | "preview">("question");
  const [codes, setCodes] = useState<string[]>([...DEFAULT_SALARY_COUNTRY_CODES]);
  const [copy, setCopy] = useState<CopyState>("idle");
  const prompt = buildSalaryPrompt(careerTitle, codes);
  const selected = resolveSalaryCountries(codes);

  const open = () => {
    setTab("question");
    setCopy("idle");
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();

  const toggleCountry = (code: string) => {
    setCopy("idle");
    setCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const copyAndOpen = () => {
    if (!prompt) return;
    // Start the copy and open the tab inside the same click, so neither is blocked.
    const copied = navigator.clipboard?.writeText ? navigator.clipboard.writeText(prompt).then(() => true, () => false) : Promise.resolve(false);
    window.open(GEMINI_APP_URL, "_blank", "noopener,noreferrer");
    void copied.then((ok) => setCopy(ok ? "copied" : "manual"));
  };

  return (
    <>
      {variant === "button" ? (
        <button type="button" className="ce-btn" data-variant="primary" onClick={open}>
          <Sparkles aria-hidden="true" />
          Research Salaries with Gemini
        </button>
      ) : (
        <button type="button" className="ce-gemini-btn" onClick={open} aria-label={`Research salaries for ${careerTitle} with Gemini`}>
          <Sparkles aria-hidden="true" />
          Research with Gemini
        </button>
      )}
      <dialog
        ref={dialog}
        className="ce ce-dialog"
        aria-labelledby={titleId}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <div className="ce-dialog-in">
          <div className="ce-dialog-head">
            <h2 id={titleId}>
              <Sparkles aria-hidden="true" />
              Salary research · {careerTitle}
            </h2>
            <button type="button" className="ce-btn" data-variant="outline" data-size="sm" onClick={close}>
              <ArrowLeft aria-hidden="true" />
              Back to career profile
            </button>
          </div>

          <div className="ce-steps" role="tablist" aria-label="Salary research">
            <button type="button" role="tab" id={`${titleId}-t1`} aria-selected={tab === "question"} aria-controls={`${titleId}-p1`} onClick={() => setTab("question")}>
              1 · Your prepared question
            </button>
            <button type="button" role="tab" id={`${titleId}-t2`} aria-selected={tab === "preview"} aria-controls={`${titleId}-p2`} onClick={() => setTab("preview")}>
              2 · Answer preview <span className="ce-concept">CONCEPT</span>
            </button>
          </div>

          {tab === "question" ? (
            <div className="ce-dialog-grid" role="tabpanel" id={`${titleId}-p1`} aria-labelledby={`${titleId}-t1`}>
              <div>
                <p className="ce-label" id={`${titleId}-c`}>
                  Countries to compare
                </p>
                <fieldset className="ce-countries" aria-labelledby={`${titleId}-c`}>
                  {SALARY_COUNTRIES.map((country) => (
                    <label key={country.code}>
                      <input type="checkbox" checked={codes.includes(country.code)} onChange={() => toggleCountry(country.code)} />
                      <span>{country.label}</span>
                    </label>
                  ))}
                </fieldset>
                {prompt ? (
                  <p className="ce-prompt" data-testid="salary-prompt">
                    {prompt}
                  </p>
                ) : (
                  <p className="ce-prompt" data-empty="" role="alert">
                    Choose at least one country to prepare the question.
                  </p>
                )}
                <p className="ce-note" style={{ marginTop: 10 }}>
                  Built from this career&rsquo;s title and the {selected.length === 1 ? "country" : "countries"} you select — nothing else.
                </p>
              </div>
              <div>
                <div className="ce-shared">
                  <p className="ce-label">What is shared</p>
                  <ul>
                    <li>
                      <Check aria-hidden="true" />
                      The career title
                    </li>
                    <li>
                      <Check aria-hidden="true" />
                      The countries you select
                    </li>
                    <li data-no="">
                      <X aria-hidden="true" />
                      Never your marks, assessment answers, payment or personal details
                    </li>
                  </ul>
                </div>
                <div className="ce-dialog-cta">
                  <button type="button" className="ce-btn" data-variant="navy" data-block="" disabled={!prompt} onClick={copyAndOpen}>
                    <Copy aria-hidden="true" />
                    Copy question and open Gemini
                    <ExternalLink aria-hidden="true" />
                  </button>
                  <p role="status" data-error={copy === "manual" ? "" : undefined}>
                    {copy === "copied" ? "Question copied. Gemini has opened in a new tab — paste the question there and send it." : null}
                    {copy === "manual" ? "Gemini has opened in a new tab, but the question could not be copied automatically. Select the question on the left, copy it and paste it into Gemini." : null}
                  </p>
                  <p className="ce-note">
                    Gemini has no official link that sends a question for you. This button copies the question and opens Gemini; you paste and send it
                    yourself. Gemini&rsquo;s answer appears in Gemini, not on Nextwise.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div role="tabpanel" id={`${titleId}-p2`} aria-labelledby={`${titleId}-t2`}>
              <p className="ce-preview-warn">
                <strong>Concept only.</strong> This shows how a salary answer might be laid out in a possible future version. The bars are placeholders —
                they are not salaries and no figure is shown. Nextwise does not publish salary data.
              </p>
              <div className="ce-preview-wrap">
                <table className="ce-preview">
                  <thead>
                    <tr>
                      <th scope="col">Country</th>
                      <th scope="col">Entry level</th>
                      <th scope="col">Mid-career</th>
                      <th scope="col">Senior level</th>
                      <th scope="col">Estimate type</th>
                      <th scope="col">Source · year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.length > 0 ? selected : resolveSalaryCountries(DEFAULT_SALARY_COUNTRY_CODES)).map((country) => (
                      <tr key={country.code}>
                        <td>{country.label}</td>
                        {[0, 1, 2, 3, 4].map((i) => (
                          <td key={i}>
                            <i aria-hidden="true" />
                            <span className="ce-sr">placeholder</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ce-note" style={{ marginTop: 16 }}>
                Salary is one factor among several. Compare the work itself, the study route and where you would live. To get real, sourced figures
                today, use &ldquo;Your prepared question&rdquo;.
              </p>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
