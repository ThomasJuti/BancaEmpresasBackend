import type { DeliveryEmailPayload } from '../domain/email-sender.js';
import { BANCO_BOGOTA_LOGO_BASE64_PNG } from './logo-base64.js';

/** Asunto del correo de confirmación de entrega (cambia si es recordatorio). */
export function buildDeliverySubject(isRetry: boolean): string {
  return isRetry
    ? 'Recordatorio: confirme la entrega de la tarjeta empresarial'
    : 'Confirme la entrega de la tarjeta empresarial';
}

// Paleta de la app (src/styles.css del frontend).
const PRIMARY = '#0f4c97';
const ACCENT = '#1b4da1';
const TINT = '#e5effb';
const HEADING = '#2b2b2b';
const BODY = '#556072';
const BORDER = '#e6ecf2';
const PAGE_BG = '#f4f7fb';

/**
 * Cuerpo HTML del correo, con layout de tablas y estilos inline para que
 * renderice consistente en clientes de correo (Gmail ignora <style> y flex/grid).
 */
export function buildDeliveryHtml(payload: DeliveryEmailPayload): string {
  const retryNotice = payload.isRetry
    ? `<tr><td style="padding: 0 32px 4px;">
         <div style="background:#fef3e2; border-left:4px solid #d98324; border-radius:8px; padding:12px 16px; font-size:14px; color:#8a5a1a;">
           <strong>Recordatorio:</strong> aún no hemos recibido la confirmación de entrega.
         </div>
       </td></tr>`
    : '';

  return `
<div style="background:${PAGE_BG}; padding:32px 16px; font-family:'Segoe UI',Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid ${BORDER}; border-radius:16px; overflow:hidden;">
    <tr>
      <td align="center" style="background:#ffffff; padding:24px 32px; border-bottom:3px solid ${PRIMARY};">
        <img
          src="data:image/png;base64,${BANCO_BOGOTA_LOGO_BASE64_PNG}"
          width="140"
          alt="Banco de Bogotá"
          style="display:block; max-width:140px; height:auto;"
        />
        <p style="margin:10px 0 0; color:${BODY}; font-size:13px;">Tarjeta de Crédito LATAM Business</p>
      </td>
    </tr>

    <tr>
      <td style="padding:32px 32px 8px;">
        <h1 style="margin:0 0 16px; font-size:20px; color:${HEADING}; font-weight:700;">Confirmación de entrega de tarjeta</h1>
        <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${BODY};">Hola ${payload.managerName},</p>
      </td>
    </tr>

    ${retryNotice}

    <tr>
      <td style="padding:8px 32px 0;">
        <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:${BODY};">
          La tarjeta de crédito empresarial a nombre de
          <strong style="color:${HEADING};">${payload.cardHolderName}</strong> fue enviada a su empresa.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${TINT}; border-radius:12px; margin:0 0 24px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0; font-size:12px; color:${BODY}; text-transform:uppercase; letter-spacing:0.5px;">Tarjeta terminada en</p>
              <p style="margin:4px 0 0; font-size:22px; font-weight:800; color:${PRIMARY}; letter-spacing:2px;">•••• ${payload.cardLastFour}</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px; font-size:15px; line-height:1.6; color:${BODY};">Por favor confírmenos si ya fue entregada a su titular:</p>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:16px 32px 28px;">
        <a href="${payload.confirmationUrl}"
           style="display:inline-block; background:${ACCENT}; color:#ffffff; font-size:16px; font-weight:700; text-decoration:none; padding:14px 36px; border-radius:10px;">
          Confirmar entrega
        </a>
      </td>
    </tr>

    <tr>
      <td style="padding:0 32px 32px; border-top:1px solid ${BORDER};">
        <p style="margin:20px 0 0; font-size:12px; line-height:1.5; color:#8a94a6;">
          Este enlace es personal y de un solo uso. Si usted no es la persona indicada, ignore este correo.
        </p>
      </td>
    </tr>
  </table>
</div>`;
}
