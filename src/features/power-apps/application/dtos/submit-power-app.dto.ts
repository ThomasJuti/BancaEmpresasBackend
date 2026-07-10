import { z } from 'zod';

export const submitPowerAppSchema = z.object({
  leadId: z.string().trim().min(1).optional(),
  campana: z.string().trim().min(1).optional(),
  asesorId: z.string().trim().min(1).optional(),

  segmento: z.string().trim().min(1, 'El segmento es obligatorio'),
  tipoIdentificacionEmpresa: z.literal('NIT'),
  tipoIdentificacionTarjetahabiente: z.enum(['CC', 'CE', 'PA', 'TI']),
  numeroIdentificacionTarjetahabiente: z
    .string()
    .trim()
    .min(1, 'El número de identificación del tarjetahabiente es obligatorio'),
  unidadNegocios: z.string().trim().min(1, 'La unidad de negocios es obligatoria'),
  tipoTarjetaNueva: z.string().trim().min(1, 'El tipo de tarjeta nueva es obligatorio'),
  identificacionEmpresa: z.string().trim().min(1, 'La identificación de la empresa es obligatoria'),
  nombreEmpresa: z.string().trim().min(1, 'El nombre de la empresa es obligatorio'),
  nombreTarjetahabiente: z.string().trim().min(1, 'El nombre del tarjetahabiente es obligatorio'),

  binProducto: z.string().trim().min(1, 'El BIN del producto es obligatorio'),
  cargoDebitoAutomatico: z.string().trim().min(1, 'El cargo de débito automático es obligatorio'),
  cupoTarjetaNueva: z.number().positive('El cupo de la tarjeta nueva debe ser mayor a cero'),
  cupoDisponibleCec: z.number().nonnegative().optional(),

  archivosAdjuntos: z
    .array(z.string().trim().min(1, 'Cada archivo adjunto debe tener nombre'))
    .min(1, 'Debe adjuntar al menos una imagen del caso'),

  codigoOficinaCentroServicio: z
    .string()
    .trim()
    .min(1, 'El código de oficina / centro de servicio es obligatorio'),
  ciudadPuntoEntrega: z.string().trim().min(1, 'La ciudad del punto de entrega es obligatoria'),
  direccionPuntoComercial: z
    .string()
    .trim()
    .min(1, 'La dirección del punto comercial es obligatoria'),
  puntoEntrega: z.enum(['PUNTO_ENTREGA_A_COMERCIAL', 'ENVIO_CERTIFICADO_COURIER']),

  ruesSolicitudId: z.string().trim().min(1).optional(),
  ruesConsultadoEn: z.string().trim().min(1).optional(),
  documentoOrigen: z.enum(['RUES', 'MANUAL']).optional(),
  ruesConsultation: z
    .object({
      solicitudId: z.string().trim().min(1),
      nit: z.string().trim().min(1),
      consultadoEn: z.string().trim().min(1),
      urlConsulta: z.string().trim().min(1),
      razonSocial: z.string().trim().min(1),
      datos: z.record(z.string(), z.string()),
      secciones: z.record(z.string(), z.record(z.string(), z.string())).optional(),
      representantes: z
        .array(
          z.object({
            documento: z.string(),
            nombre: z.string(),
          }),
        )
        .optional(),
      actividades: z.array(z.string()).optional(),
    })
    .optional(),
});

export type SubmitPowerAppDto = z.infer<typeof submitPowerAppSchema>;
