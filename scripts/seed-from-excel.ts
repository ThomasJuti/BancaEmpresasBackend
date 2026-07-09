/**
 * Precarga las 3 tablas fuente del cruce (paso 1 del pipeline) desde los Excel en docs/.
 * En producción estas tablas se poblarán desde una fuente externa; este seed es solo para pruebas.
 *
 * Uso:
 *   npm run seed              — parsea y sube a Supabase (requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env)
 *   npm run seed -- --dry-run — solo parsea y muestra conteos, no toca la base
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { getSupabaseClient } from '../src/infrastructure/database/supabase.js';

type ColumnType = 'text' | 'numeric' | 'date';

interface ColumnMapping {
  /** Encabezado exacto en el Excel (se compara con trim) */
  header: string;
  /** Columna destino en Supabase */
  column: string;
  type: ColumnType;
}

interface SourceConfig {
  file: string;
  sheet: string;
  table: string;
  /** Columna llave del cruce: las filas sin este valor se descartan */
  keyColumn: string;
  columns: ColumnMapping[];
}

// npm ejecuta los scripts con cwd en la raíz del paquete
const DOCS_DIR = path.resolve(process.cwd(), 'docs');
const BATCH_SIZE = 1000;

const sources: SourceConfig[] = [
  {
    file: 'Copia de Base Potencial _ VP Banca Empresas.xlsx',
    sheet: 'DATA',
    table: 'base_potencial',
    keyColumn: 'cliente_id',
    columns: [
      { header: 'Cliente_Id', column: 'cliente_id', type: 'text' },
      { header: 'Cliente_Nombre', column: 'cliente_nombre', type: 'text' },
      { header: 'Relacion', column: 'relacion', type: 'text' },
      { header: 'Tipo_Cliente', column: 'tipo_cliente', type: 'text' },
      { header: 'Cliente_Gestionable', column: 'cliente_gestionable', type: 'text' },
      { header: 'Ciudad', column: 'ciudad', type: 'text' },
      { header: 'Direccion', column: 'direccion', type: 'text' },
      { header: 'Subsegmento', column: 'subsegmento', type: 'text' },
      { header: 'Producto TC', column: 'producto_tc', type: 'text' },
    ],
  },
  {
    file: 'CEC.xlsx',
    sheet: 'activos cec',
    table: 'cec',
    keyColumn: 'nume_iden',
    columns: [
      { header: 'PROY CRED', column: 'proy_cred', type: 'text' },
      { header: 'TIPO IDEN', column: 'tipo_iden', type: 'text' },
      { header: 'NUME IDEN', column: 'nume_iden', type: 'text' },
      { header: 'NOMBRE COMPLETO', column: 'nombre_completo', type: 'text' },
      { header: 'FECHA REVISION', column: 'fecha_revision', type: 'date' },
      { header: 'LEA APROBADO', column: 'lea_aprobado', type: 'numeric' },
      { header: 'DISPONIBLE', column: 'disponible', type: 'numeric' },
    ],
  },
  {
    file: 'Clientes potenciales para grabar SG.xlsx',
    sheet: 'Base',
    table: 'clientes_potenciales_grabar',
    keyColumn: 'identificacion',
    columns: [
      { header: 'Segmento', column: 'segmento', type: 'text' },
      { header: 'Direccion', column: 'direccion', type: 'text' },
      { header: 'Zona', column: 'zona', type: 'text' },
      { header: 'Domicilio', column: 'domicilio', type: 'text' },
      { header: 'FECHA VIGENCIA PC', column: 'fecha_vigencia_pc', type: 'date' },
      { header: 'TIPO ID', column: 'tipo_id', type: 'text' },
      { header: 'IDENTIFICACION', column: 'identificacion', type: 'text' },
      { header: 'NOMBRE COMPLETO', column: 'nombre_completo', type: 'text' },
      { header: 'LEA Total Cliente', column: 'lea_total_cliente', type: 'numeric' },
      { header: '5% del LEA Total Cliente', column: 'pct5_lea_total', type: 'numeric' },
      { header: 'Aprobado familia KW', column: 'aprobado_familia_kw', type: 'numeric' },
      { header: 'Disponible familia KW', column: 'disponible_familia_kw', type: 'numeric' },
      { header: '% utilizado familia KW', column: 'pct_utilizado_familia_kw', type: 'numeric' },
      { header: 'Máximo disponible de tx (sin KW)', column: 'max_disponible_tx', type: 'numeric' },
      { header: 'Máximo aprobado entre límite 1, 2 y 3 de KW', column: 'max_aprobado_limites_kw', type: 'numeric' },
      { header: 'Valor sugerido', column: 'valor_sugerido', type: 'numeric' },
      { header: 'VoBo para grabar', column: 'vobo_para_grabar', type: 'text' },
      { header: 'Observación', column: 'observacion', type: 'text' },
      { header: 'Nuevo valor sugerido', column: 'nuevo_valor_sugerido', type: 'numeric' },
      { header: 'Garantía', column: 'garantia', type: 'text' },
      { header: 'Estado', column: 'estado', type: 'text' },
      { header: 'Tipo', column: 'tipo', type: 'text' },
      { header: 'Subtipo', column: 'subtipo', type: 'text' },
    ],
  },
];

/** Aplana el valor de una celda de exceljs a un primitivo. */
function cellToRaw(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((t) => t.text).join('');
    if ('result' in value) return cellToRaw(value.result as ExcelJS.CellValue);
    if ('text' in value) return typeof value.text === 'string' ? value.text : null;
    return null;
  }
  return value;
}

/** Días entre la época de Excel (1899-12-30) y una fecha serial. */
function excelSerialToIsoDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + serial * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function toText(raw: string | number | boolean | Date | null): string | null {
  if (raw === null) return null;
  const text = String(raw).trim();
  return text === '' ? null : text;
}

function toNumeric(raw: string | number | boolean | Date | null): number | null {
  if (raw === null || raw instanceof Date || typeof raw === 'boolean') return null;
  const num = typeof raw === 'number' ? raw : Number(String(raw).trim());
  return Number.isFinite(num) ? num : null;
}

function toDate(raw: string | number | boolean | Date | null): string | null {
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const serial = toNumeric(raw);
  return serial === null || serial <= 0 ? null : excelSerialToIsoDate(serial);
}

function convert(raw: string | number | boolean | Date | null, type: ColumnType) {
  switch (type) {
    case 'text':
      return toText(raw);
    case 'numeric':
      return toNumeric(raw);
    case 'date':
      return toDate(raw);
  }
}

async function parseSource(source: SourceConfig): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(DOCS_DIR, source.file));
  const sheet = workbook.getWorksheet(source.sheet);
  if (!sheet) {
    throw new Error(`Hoja '${source.sheet}' no encontrada en ${source.file}`);
  }

  // Mapa encabezado (trim) -> índice de columna, para ser resiliente a reordenamientos
  const headerIndex = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const header = toText(cellToRaw(cell.value));
    if (header) headerIndex.set(header, colNumber);
  });

  const missing = source.columns.filter((c) => !headerIndex.has(c.header));
  if (missing.length > 0) {
    throw new Error(
      `En ${source.file} faltan encabezados esperados: ${missing.map((c) => c.header).join(', ')}`,
    );
  }

  const rows: Record<string, unknown>[] = [];
  let skippedWithoutKey = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, unknown> = {};
    for (const mapping of source.columns) {
      const raw = cellToRaw(row.getCell(headerIndex.get(mapping.header)!).value);
      record[mapping.column] = convert(raw, mapping.type);
    }
    if (record[source.keyColumn] === null) {
      skippedWithoutKey += 1;
      return;
    }
    rows.push(record);
  });

  if (skippedWithoutKey > 0) {
    console.warn(`  ${source.table}: ${skippedWithoutKey} filas descartadas sin ${source.keyColumn}`);
  }
  return rows;
}

async function uploadRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  const supabase = getSupabaseClient();

  const { error: deleteError } = await supabase.from(table).delete().gte('id', 0);
  if (deleteError) {
    throw new Error(`Error limpiando ${table}: ${deleteError.message}`);
  }

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`Error insertando en ${table} (lote desde fila ${offset}): ${error.message}`);
    }
    const uploaded = Math.min(offset + BATCH_SIZE, rows.length);
    process.stdout.write(`\r  ${table}: ${uploaded}/${rows.length} filas subidas`);
  }
  process.stdout.write('\n');
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  console.log(dryRun ? 'Modo dry-run: solo parseo, sin subir a Supabase\n' : 'Seed hacia Supabase\n');

  for (const source of sources) {
    console.log(`Procesando ${source.table} <- "${source.file}" (hoja "${source.sheet}")`);
    const rows = await parseSource(source);
    console.log(`  ${source.table}: ${rows.length} filas parseadas`);
    if (!dryRun) {
      await uploadRows(source.table, rows);
    }
  }

  console.log('\nListo.');
}

main().catch((error: unknown) => {
  console.error('Seed falló:', error instanceof Error ? error.message : error);
  process.exit(1);
});
