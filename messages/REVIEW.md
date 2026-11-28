# Wording that needs professional review

The message files are written by engineering. Before production, these groups need review by a native-speaking professional in the field. The final MVP report lists any that are still open.

| Area | Keys | Reviewer |
| --- | --- | --- |
| Medical wording (symptoms, red flags, consultation, certificates) | `consultation.*`, `safety.*`, `certificates.*` once converted | Clinician |
| Prices and fees (PAngV, GOÄ references, self-pay confirmation) | `booking.price.*`, `settlement.*` once converted | Legal / tax advisor |
| Legal notices and consent wording | any key ending in `Consent`, `Notice` or `Terms` | Legal |

Legal documents (platform agreement, AVV, patient terms, privacy notice) and clinical safety content are not here: the API serves them per locale.
