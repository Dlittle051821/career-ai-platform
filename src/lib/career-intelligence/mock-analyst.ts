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
    };
  });

  return {
    outcome: careers.length > 0 ? "recommendations" : "insufficient_data",
    overview:
      careers.length > 0
        ? `Based on the profile provided, ${careers.length} catalogue careers are worth exploring further. The comparison is heuristic and should be discussed with the student before any decision.`
        : "There is not yet enough profile information to suggest careers.",
    careers,
    missingInformation: p.profileGaps.slice(0, 8),
    followUpQuestions: p.profileGaps.length > 0 ? ["Could you tell us more about the areas still missing from your profile?"] : ["Which of these careers would you like to learn more about first?"],
    uncertainties: ["Interests and preferences are self-reported and may change.", ...p.profileConflicts.slice(0, 3)],
    counsellorFlags: [
      ...(p.isMinor ? [{ code: "minor_student" as const, note: "Student appears to be under 18 — involve a parent or guardian." }] : []),
      ...p.profileConflicts.slice(0, 3).map((note) => ({ code: "conflicting_preferences" as const, note: note.slice(0, 240) })),
    ],
  };
}
