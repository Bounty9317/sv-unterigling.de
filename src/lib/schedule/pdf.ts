/**
 * PDF-Listen (jsPDF) im Layout der bisherigen Seite:
 *  - Zeitraum-Liste im Querformat (Wirte: Samstag | Sonntag/Feiertage, Aufsicht: Samstag)
 *  - Persönliche Terminliste im Hochformat
 * jsPDF wird erst beim Erstellen einer PDF geladen.
 */
import { MONTHS_SHORT, formatDate, todayISO } from '../dates';
import type { DateRangeData, PdfRow, PersonListData } from './pdf-data';
import type { ScheduleType } from './types';

type JsPDF = import('jspdf').jsPDF;

const BRAND: [number, number, number] = [26, 71, 42];
const HEADER_GRAY: [number, number, number] = [200, 200, 200];
const LOGO_RATIO = 644 / 387;

let logoPromise: Promise<string | null> | undefined;

function loadLogo(): Promise<string | null> {
  logoPromise ??= fetch('/images/logo-pdf.jpg')
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('Logo fehlt'))))
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
    )
    .catch(() => null);
  return logoPromise;
}

async function newDoc(orientation: 'landscape' | 'portrait'): Promise<JsPDF> {
  const { jsPDF } = await import('jspdf');
  return new jsPDF({ orientation, unit: 'mm', format: 'a4' });
}

function hexToRgb(hex: string | undefined): [number, number, number] {
  if (!hex) return [240, 240, 240];
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h[0]! + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (!/^[0-9a-f]{6}/i.test(h) || Number.isNaN(n)) return [240, 240, 240];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Text auf Spaltenbreite kürzen */
function fit(doc: JsPDF, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function created() {
  return `Erstellt am: ${formatDate(todayISO())}`;
}

/* ---------- Zeitraum-Liste ---------- */

const COLS = [20, 30, 35, 35] as const; // Tag, Datum, Name, Bemerkung
const COL_WIDTH = COLS.reduce((a, b) => a + b, 0);
const ROW_H = 8;
const PER_COLUMN = 17;
const TABLE_TOP = 48;

function rangeLabel(startMonth: string, endMonth: string) {
  const label = (ym: string) => {
    const [y, m] = ym.split('-');
    return `${MONTHS_SHORT[Number(m) - 1]} ${y!.slice(2)}`;
  };
  return `${label(startMonth)} bis ${label(endMonth)}`;
}

function drawRangeHeader(doc: JsPDF, type: ScheduleType, timeRange: string, logo: string | null, first: boolean) {
  if (first && logo) {
    const w = 60;
    const h = w / LOGO_RATIO;
    doc.addImage(logo, 'JPEG', 15, 8, w, h);
    doc.addImage(logo, 'JPEG', 297 - 15 - w, 8, w, h);
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(type === 'wirte' ? 'Wirte Liste' : 'Schießaufsicht Liste', 148, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.text(type === 'wirte' ? 'Samstag / Sonntag/Feiertage' : 'Samstag', 148, 28, { align: 'center' });
  doc.setFontSize(10);
  doc.text(created(), 148, 35, { align: 'center' });
  doc.text(timeRange, 148, 41, { align: 'center' });
}

function drawColumnHeader(doc: JsPDF, x: number, y: number, title: string): number {
  doc.setFillColor(...BRAND);
  doc.rect(x, y, COL_WIDTH, ROW_H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, x + 5, y + 5.5);
  y += ROW_H;

  doc.setDrawColor(0, 0, 0);
  doc.setFontSize(10);
  const labels = ['Tag', 'Datum', 'Name', 'Bemerkung'];
  let cx = x;
  COLS.forEach((w, i) => {
    // jsPDF nutzt die Füllfarbe auch für Text – deshalb vor jedem Rechteck neu setzen
    doc.setFillColor(...HEADER_GRAY);
    doc.rect(cx, y, w, ROW_H, 'FD');
    doc.setTextColor(0, 0, 0);
    doc.text(labels[i]!, cx + 3, y + 5.5);
    cx += w;
  });
  return y + ROW_H;
}

function drawRow(doc: JsPDF, x: number, y: number, row: PdfRow) {
  doc.setFillColor(...hexToRgb(row.color));
  doc.setDrawColor(0, 0, 0);
  let cx = x;
  COLS.forEach((w) => {
    doc.rect(cx, y, w, ROW_H, 'FD');
    cx += w;
  });
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(row.irregular ? `! ${row.weekday}` : row.weekday, x + 3, y + 5.5);
  doc.text(row.dateLabel, x + COLS[0] + 3, y + 5.5);
  doc.text(fit(doc, row.name, COLS[2] - 4), x + COLS[0] + COLS[1] + 2, y + 5.5);
  doc.setFontSize(8);
  doc.text(fit(doc, row.remark, COLS[3] - 4), x + COLS[0] + COLS[1] + COLS[2] + 2, y + 5.5);
}

function drawColumn(
  doc: JsPDF,
  rows: PdfRow[],
  x: number,
  title: string,
  ensurePage: (page: number) => void,
) {
  const pages = Math.max(1, Math.ceil(rows.length / PER_COLUMN));
  for (let p = 0; p < pages; p++) {
    ensurePage(p + 1);
    doc.setPage(p + 1);
    let y = drawColumnHeader(doc, x, TABLE_TOP, title);
    for (const row of rows.slice(p * PER_COLUMN, (p + 1) * PER_COLUMN)) {
      drawRow(doc, x, y, row);
      y += ROW_H;
    }
  }
}

export async function downloadDateRangePdf(params: {
  type: ScheduleType;
  startMonth: string;
  endMonth: string;
  data: DateRangeData;
}) {
  const { type, startMonth, endMonth, data } = params;
  const [doc, logo] = await Promise.all([newDoc('landscape'), loadLogo()]);
  const timeRange = rangeLabel(startMonth, endMonth);
  drawRangeHeader(doc, type, timeRange, logo, true);

  const ensurePage = (page: number) => {
    while (doc.getNumberOfPages() < page) {
      doc.addPage();
      drawRangeHeader(doc, type, timeRange, logo, false);
    }
  };

  if (type === 'aufsicht') {
    drawColumn(doc, data.left, (297 - COL_WIDTH) / 2, 'Samstag', ensurePage);
  } else {
    drawColumn(doc, data.left, 20, 'Samstag', ensurePage);
    drawColumn(doc, data.right, 297 - 20 - COL_WIDTH, 'Sonntag/Feiertage', ensurePage);
  }
  doc.save(`${type}-liste-${startMonth}-bis-${endMonth}.pdf`);
}

/* ---------- Persönliche Liste ---------- */

export async function downloadPersonPdf(params: {
  type: ScheduleType;
  person: string;
  color: string;
  data: PersonListData;
}) {
  const { type, person, color, data } = params;
  const [doc, logo] = await Promise.all([newDoc('portrait'), loadLogo()]);
  const withSlot = type === 'wirte';
  const cols = withSlot ? [18, 28, 34, 90] : [20, 30, 120];
  const labels = withSlot ? ['Tag', 'Datum', 'Dienst', 'Bemerkung'] : ['Tag', 'Datum', 'Bemerkung'];
  const left = 20;
  const width = cols.reduce((a, b) => a + b, 0);

  if (logo) {
    const w = 32;
    doc.addImage(logo, 'JPEG', 12, 8, w, w / LOGO_RATIO);
    doc.addImage(logo, 'JPEG', 210 - 12 - w, 8, w, w / LOGO_RATIO);
  }
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(type === 'wirte' ? 'Wirte-Einteilungen' : 'Schießaufsicht-Einteilungen', 105, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text(person, 105, 30, { align: 'center' });
  doc.setFontSize(10);
  doc.text(created(), 105, 38, { align: 'center' });
  doc.text(`Anzahl Termine: ${data.rows.length}`, 105, 44, { align: 'center' });

  const header = (y: number) => {
    doc.setFillColor(...BRAND);
    doc.rect(left, y, width, ROW_H, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    let cx = left;
    cols.forEach((w, i) => {
      doc.text(labels[i]!, cx + 4, y + 5.5);
      cx += w;
    });
    return y + ROW_H;
  };

  let y = header(55);
  const fill = hexToRgb(color);
  for (const row of data.rows) {
    if (y > 270) {
      doc.addPage();
      y = header(20);
    }
    doc.setFillColor(...fill);
    doc.setDrawColor(0, 0, 0);
    let cx = left;
    cols.forEach((w) => {
      doc.rect(cx, y, w, ROW_H, 'FD');
      cx += w;
    });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(row.weekday, left + 4, y + 5.5);
    doc.text(row.dateLabel, left + cols[0]! + 3, y + 5.5);
    let remarkX = left + cols[0]! + cols[1]!;
    if (withSlot) {
      doc.text(row.slotLabel, remarkX + 3, y + 5.5);
      remarkX += cols[2]!;
    }
    doc.setFontSize(8);
    doc.text(fit(doc, row.remark, cols[cols.length - 1]! - 6), remarkX + 3, y + 5.5);
    y += ROW_H;
  }

  doc.save(`${type}-${person.trim().replace(/\s+/g, '-')}.pdf`);
}
