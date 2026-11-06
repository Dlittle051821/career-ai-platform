import type { PromptPayload } from "./prompt";
import type { ModelOutput } from "./schema";

/**
 * NW09 — the deterministic "analyst" behind the mock provider. Builds a
 * schema-valid ModelOutput purely from the prompt payload (the same data a
 * real model would receive): same input → same output, no network, no cost.
 * It deliberately says nothing the payload does not contain, so tests can
 * assert that the pipeline (not the model) is what guarantees catalogue-only,
 * evidence-backed output.
 */
export function mockCareerAnalyst(raw: unknown): ModelOutput {
  const p = raw as PromptPayload;
  const s = p.student;
  const interests = s.interests.map((i) => i.interest);
  const skills = s.skills.map((x) => x.skill);
  const strong = s.subjectStrengths.filter((x) => /strong|above/i.test(x.rating)).map((x) => x.subject);

  const careers = p.candidates.map((c, i) => {
    const evidence = [
      ...strong.slice(0, 2).map((subj) => `Rates ${subj} highly.`),
      ...interests.slice(0, 2).map((x) => `Lists an interest in ${x}.`),
      ...c.engineReasons.slice(0, 2),
    ];
    return {
      candidateRef: c.ref,
      suitability: (i === 0 ? "worth_discussing" : i < 3 ? "possible_fit" : "weak_fit") as ModelOutput["careers"][number]["suitability"],
      fitExplanation: `${c.title} (${c.family}) came out as a ${c.heuristicBand.toLowerCase()} on the matching engine's heuristic comparison with this profile. ${c.engineReasons[0] ?? "Several stated preferences overlap with this career."} This is a starting point for discussion, not a verdict.`,
      supportingEvidence: evidence.length > 0 ? evidence.slice(0, 6) : ["The matching engine found some overlap with the stated profile."],
      alignedInterests: interests.slice(0, 4),
      skillsDemonstrated: skills.slice(0, 4),
      skillGaps: c.engineGaps.slice(0, 4),
      unmetRequirements: c.minimumEducation ? [`Typically requires at least: ${c.minimumEducation}.`] : [],
      educationPathways: c.educationRoutes.slice(0, 3),
      nextActions: [`Read the Nextwise career page for ${c.title} and note what appeals and what does not.`, "Talk to the counsellor about which subjects or skills to build next."],
      assumptionsToVerify: /limited/i.test(c.evidenceCoverage) ? ["The profile covers few of the factors this career depends on — confirm interest directly."] : [],
      tradeOffs: c.engineGaps.length > 0 ? [`Would mean building: ${c.engineGaps[0]}`] : [],
      reasonsItMayNotSuit: [c.engineGaps[0] ? `The engine noted a gap: ${c.engineGaps[0]}` : "The match rests on self-reported preferences that have not been tested in practice."],
    };
  });
  const notStated = "Not stated in the profile.";
  const fields = Array.from(new Set(s.education.map((e) => e.field).filter((f): f is string => Boolean(f)))).slice(0, 3);

  return {
    outcome: careers.length > 0 ? "recommendations" : "insufficient_data",
    overview:
      careers.length > 0
        ? `Based on the profile provided, ${careers.length} catalogue careers are worth exploring further. The comparison is heuristic and should be discussed with the student before any decision.`
        : "There is not yet enough profile information to suggest careers.",
    profileInterpretation: {
      academicBackground: s.education.length > 0 ? s.education.map((e) => `${e.level}${e.field ? ` (${e.field})` : ""}, ${e.status}`).join("; ") : notStated,
      strengths: strong.slice(0, 6),
      interests: interests.slice(0, 6),
      motivations: s.goals?.statedReason ? [s.goals.statedReason] : [],
      priorities: s.careerPriorities.slice(0, 6).map((x) => `${x.priority}: ${x.response}`),
      uncertainties: p.profileGaps.slice(0, 6),
      financialConsiderations: s.budget?.band ? `Stated budget band: ${s.budget.band}${s.budget.fundingSource ? `; funding: ${s.budget.fundingSource}` : ""}.` : notStated,
    },
    careers,
    careerComparison: {
      summary: careers.length > 1 ? "The careers below differ mainly in how much of the profile supports them; the heuristic band is the only rating used." : "Only one career had enough evidence to discuss.",
      points: p.candidates.map((c) => ({ candidateRef: c.ref, distinctiveStrength: c.engineReasons[0] ?? "Some overlap with the profile.", mainConcern: c.engineGaps[0] ?? "Evidence is self-reported." })),
    },
    academicDirection: {
      recommendedLevel: s.stage && /under|post|working/i.test(s.stage) ? "masters" : s.stage ? "bachelors" : "undecided",
      fields: fields.length > 0 ? fields : p.candidates.slice(0, 2).flatMap((c) => c.educationRoutes.slice(0, 1)),
      rationale: "Derived from the current stage and the education routes listed for the catalogue careers. Specific programmes must be checked with the counsellor.",
      toVerify: ["Entry requirements for any specific programme."],
    },
    developmentPlan: {
      shortTerm: [{ action: "Read the career pages for the careers listed and shortlist two.", timeframe: "Next 2 weeks" }],
      longTerm: [{ action: "Build one skill gap identified above through a course or project.", timeframe: "6–12 months" }],
    },
    missingInformation: p.profileGaps.slice(0, 8),
    followUpQuestions: p.profileGaps.length > 0 ? ["Could you tell us more about the areas still missing from your profile?"] : ["Which of these careers would you like to learn more about first?"],
    uncertainties: ["Interests and preferences are self-reported and may change.", ...p.profileConflicts.slice(0, 3)],
    counsellorObservations: (p.inputReliability ?? []).filter((x) => /missing/.test(x.reliability)).slice(0, 3).map((x) => `${x.section} is missing — ask about it before concluding.`),
    counsellorFlags: [
      ...(p.isMinor ? [{ code: "minor_student" as const, note: "Student appears to be under 18 — involve a parent or guardian." }] : []),
      ...p.profileConflicts.slice(0, 3).map((note) => ({ code: "conflicting_preferences" as const, note: note.slice(0, 240) })),
    ],
  };
}
