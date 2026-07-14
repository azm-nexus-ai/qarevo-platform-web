/**
 * Medical / clinical expertise options for doctor registration.
 */

export type ExpertiseOption = {
    value: string;
    label: string;
};

export const DOCTOR_EXPERTISE_OPTIONS: ExpertiseOption[] = [
    { value: "general_practice", label: "General Practice" },
    { value: "internal_medicine", label: "Internal Medicine" },
    { value: "cardiology", label: "Cardiology" },
    { value: "dermatology", label: "Dermatology" },
    { value: "endocrinology", label: "Endocrinology" },
    { value: "gastroenterology", label: "Gastroenterology" },
    { value: "neurology", label: "Neurology" },
    { value: "obstetrics_gynecology", label: "Obstetrics & Gynecology" },
    { value: "oncology", label: "Oncology" },
    { value: "ophthalmology", label: "Ophthalmology" },
    { value: "orthopedics", label: "Orthopedics" },
    { value: "pediatrics", label: "Pediatrics" },
    { value: "psychiatry", label: "Psychiatry" },
    { value: "pulmonology", label: "Pulmonology" },
    { value: "radiology", label: "Radiology" },
    { value: "rheumatology", label: "Rheumatology" },
    { value: "surgery", label: "Surgery" },
    { value: "urology", label: "Urology" },
    { value: "anesthesiology", label: "Anesthesiology" },
    { value: "emergency_medicine", label: "Emergency Medicine" },
    { value: "family_medicine", label: "Family Medicine" },
    { value: "hematology", label: "Hematology" },
    { value: "infectious_disease", label: "Infectious Disease" },
    { value: "nephrology", label: "Nephrology" },
    { value: "otolaryngology", label: "Otolaryngology (ENT)" },
    { value: "pathology", label: "Pathology" },
    { value: "physical_medicine", label: "Physical Medicine & Rehabilitation" },
    { value: "plastic_surgery", label: "Plastic Surgery" },
    { value: "sports_medicine", label: "Sports Medicine" },
    { value: "other", label: "Other" },
];
