import { CAREER_PHOTOS, type CareerPhotoMeta } from "./photo-manifest";

/**
 * Career Explorer V5 — which photograph (if any) a career or a career family
 * shows. Photos are keyed by the career's own slug; a career without an
 * approved photograph returns null and the UI shows a neutral tile instead.
 */
export interface CareerPhoto extends CareerPhotoMeta {
  src: string;
  width: number;
  height: number;
}

const CARD_WIDTH = 800;
const CARD_HEIGHT = 500;

function toPhoto(key: string): CareerPhoto | null {
  const meta = CAREER_PHOTOS[key];
  if (!meta) return null;
  return { ...meta, src: `/career-explorer/photos/${key}/card-800.jpg`, width: CARD_WIDTH, height: CARD_HEIGHT };
}

export function getCareerPhoto(slug: string): CareerPhoto | null {
  return toPhoto(slug);
}

/**
 * One representative photograph per career family, for the category cards.
 * Each value is the photo key of a career that belongs to that family (or,
 * for finance, the family's own trading-floor photograph). A family that is
 * not listed here shows the neutral tile.
 */
const FAMILY_PHOTO_KEYS: Record<string, string> = {
  engineering: "mechanical-engineer",
  automotive_mobility: "automotive-engineer",
  marine_maritime: "marine-engineer",
  aviation_aerospace: "aerospace-engineer",
  technology_computing: "backend-developer",
  data_ai: "data-scientist",
  business_management: "management-consultant",
  finance_economics: "finance-trading-floor",
  healthcare_medicine: "medical-doctor",
  life_sciences: "life-sciences-research-scientist",
  physical_sciences: "physicist",
  environment_sustainability: "environmental-scientist",
  energy: "wind-energy-engineer",
  architecture_built_environment: "architect",
  design_creative: "graphic-designer",
  law_legal: "lawyer",
  government_public_policy: "civil-services-officer",
  education: "professor",
  operations_supply_chain: "logistics-manager",
  research_academia: "professor",
  entrepreneurship: "entrepreneur",
};

export function getFamilyPhoto(familyKey: string): CareerPhoto | null {
  const key = FAMILY_PHOTO_KEYS[familyKey];
  return key ? toPhoto(key) : null;
}

/** Every photograph with its attribution, for /careers/photo-credits. */
export function listPhotoCredits(): { key: string; photo: CareerPhoto }[] {
  return Object.keys(CAREER_PHOTOS)
    .sort()
    .map((key) => ({ key, photo: toPhoto(key)! }));
}
