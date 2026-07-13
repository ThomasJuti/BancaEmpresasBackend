import type { SubmitPowerAppDto } from '../../features/power-apps/application/dtos/submit-power-app.dto.js';

export const validPowerAppDto: SubmitPowerAppDto = {
  segmento: 'Pyme Pequeña',
  tipoIdentificacionEmpresa: 'NIT',
  tipoIdentificacionTarjetahabiente: 'CC',
  numeroIdentificacionTarjetahabiente: '12345678',
  unidadNegocios: 'Banca Empresas',
  tipoTarjetaNueva: 'LATAM BUSINESS',
  identificacionEmpresa: '9001234567',
  nombreEmpresa: 'EMPRESA DEMO SAS',
  nombreTarjetahabiente: 'JUAN PEREZ',
  binProducto: '491250',
  cargoDebitoAutomatico: 'NO',
  cupoTarjetaNueva: 5000000,
  archivosAdjuntos: ['camara.pdf', 'foto.jpg'],
  codigoOficinaCentroServicio: '610',
  ciudadPuntoEntrega: 'Bogotá',
  direccionPuntoComercial: 'Calle 100',
  puntoEntrega: 'PUNTO_ENTREGA_A_COMERCIAL',
  documentoOrigen: 'RUES',
  ruesSolicitudId: 'rues-123',
};
