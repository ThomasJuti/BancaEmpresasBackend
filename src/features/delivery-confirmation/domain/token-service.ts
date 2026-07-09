export interface ConfirmationTokenService {
  /** Genera un token firmado para un caso + gerente. */
  generate(deliveryCaseId: string, managerEmail: string): string;
  /** Hash determinístico del token para almacenamiento y uso único. */
  hash(token: string): string;
  /** Verifica firma y expiración; devuelve el payload o null si es inválido. */
  verify(token: string): { deliveryCaseId: string; managerEmail: string } | null;
}
