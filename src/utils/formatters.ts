export function formatIDR(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.round(value || 0));
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

/**
 * Kemenag & Saudi Immigration rule: passport must have >= 6 months validity
 * from the kloter departure date.
 */
export function isPassportExpiringBeforeDeparture(
  passportExpiry: string,
  departureDate: string
): boolean {
  if (!passportExpiry || passportExpiry === '-') return true;
  const exp = new Date(passportExpiry);
  const dep = new Date(departureDate || '2026-11-15');
  if (Number.isNaN(exp.getTime())) return true;
  const sixMonthsAfterDeparture = new Date(dep);
  sixMonthsAfterDeparture.setMonth(sixMonthsAfterDeparture.getMonth() + 6);
  return exp < sixMonthsAfterDeparture;
}

export function monthsUntilExpiry(passportExpiry: string, referenceDate: string): number {
  const exp = new Date(passportExpiry);
  const ref = new Date(referenceDate || '2026-11-15');
  if (Number.isNaN(exp.getTime())) return -1;
  const diffDays = (exp.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diffDays / 30);
}

/**
 * Deterministic 7x7 QR visual pattern generated from receipt hash string
 */
export function buildQrGrid(seed: string): boolean[] {
  const grid: boolean[] = [];
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      // Corner finder patterns (top-left, top-right, bottom-left)
      const inTL = r < 3 && c < 3;
      const inTR = r < 3 && c >= 6;
      const inBL = r >= 6 && c < 3;
      if (inTL || inTR || inBL) {
        const lr = r >= 6 ? r - 6 : r;
        const lc = c >= 6 ? c - 6 : c;
        grid.push(lr === 0 || lr === 2 || lc === 0 || lc === 2 || (lr === 1 && lc === 1));
      } else {
        hash ^= (r * 31 + c * 17);
        hash = Math.imul(hash, 16777619);
        grid.push((hash >>> 0) % 2 === 0);
      }
    }
  }
  return grid;
}

export function maskNik(rawNik: string): string {
  const clean = rawNik.replace(/\D/g, '');
  if (clean.length < 8) return clean || '3201••••••••0001';
  return `${clean.slice(0, 4)}••••••••${clean.slice(-4)}`;
}
