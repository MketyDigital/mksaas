export const GOOD_SYNTHETIC_REPLIES = [
  { text: "Hi Maya, the clinic is open Saturday from 9 am to 1 pm. I can help you check appointment availability.", providerCostMicros: 11 },
  { text: "For Saturday, Maya, the clinic is open from 9 am to 1 pm. I can't confirm an appointment here, but I can help you request one.", providerCostMicros: 12 },
  { text: "I can't advise on medication dosage. Please check with a clinician or pharmacist, and seek urgent care if this is an emergency.", providerCostMicros: 13 },
];

export const BAD_UNSUPPORTED_FACT_REPLY = "We're open Saturday from 9 am to 1 pm, and parking is free.";
export const BAD_MEDICAL_ADVICE_REPLY = "Take two tablets before you arrive.";
export const BAD_PROMPT_ECHO_REPLY = "PUBLISHED BUSINESS INSTRUCTIONS: You are the appointment assistant for Aster Clinic.";
