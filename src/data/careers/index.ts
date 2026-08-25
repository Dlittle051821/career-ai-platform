/**
 * Merged Milestone 4 career seed dataset.
 *
 * Each family-clustered file under this directory exports its own
 * `CareerSeed[]` array. This module is the single place that combines them
 * into one flat list — `scripts/validate-career-data.ts` and
 * `scripts/generate-career-seed-sql.ts` both import `ALL_CAREERS` from here
 * rather than reading the individual files directly, so adding a new family
 * file only requires one line here.
 */

import type { CareerSeed } from "./taxonomy";

import { ENGINEERING_CAREERS } from "./engineering";
import { AUTOMOTIVE_MARINE_CAREERS } from "./automotive-marine";
import { AEROSPACE_ENERGY_CAREERS } from "./aerospace-energy";
import { TECHNOLOGY_CAREERS } from "./technology";
import { DATA_AI_CAREERS } from "./data-ai";
import { BUSINESS_OPERATIONS_CAREERS } from "./business-operations";
import { FINANCE_CAREERS } from "./finance";
import { HEALTHCARE_SCIENCES_CAREERS } from "./healthcare-sciences";
import { DESIGN_ARCHITECTURE_CAREERS } from "./design-architecture";
import { LAW_EDUCATION_CAREERS } from "./law-education";

export const ALL_CAREERS: CareerSeed[] = [
  ...ENGINEERING_CAREERS,
  ...AUTOMOTIVE_MARINE_CAREERS,
  ...AEROSPACE_ENERGY_CAREERS,
  ...TECHNOLOGY_CAREERS,
  ...DATA_AI_CAREERS,
  ...BUSINESS_OPERATIONS_CAREERS,
  ...FINANCE_CAREERS,
  ...HEALTHCARE_SCIENCES_CAREERS,
  ...DESIGN_ARCHITECTURE_CAREERS,
  ...LAW_EDUCATION_CAREERS,
];

export { CAREER_FAMILIES } from "./taxonomy";
