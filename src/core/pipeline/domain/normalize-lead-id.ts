/** Normaliza identificadores de lead (NIT) para cruce consistente en pipeline_cases. */
export function normalizeLeadId(leadId: string): string {
  const trimmed = leadId.trim();
  const digits = trimmed.replace(/\D/g, '');
  return digits || trimmed;
}
