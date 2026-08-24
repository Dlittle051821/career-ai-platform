import type { ContactPurpose } from "@/types";

export const CONTACT_PURPOSES: ContactPurpose[] = [
  {
    title: "Student guidance",
    description: "Questions about career discovery, courses, or the journey ahead.",
    icon: "student",
  },
  {
    title: "Parent questions",
    description: "Cost, safety, process, or anything you'd want answered before committing.",
    icon: "parent",
  },
  {
    title: "Partnership enquiry",
    description: "Institutions, counsellors, or organisations interested in working with us.",
    icon: "partner",
  },
  {
    title: "Complaint / escalation",
    description: "An issue with our service that needs to be raised and reviewed.",
    icon: "complaint",
  },
];
