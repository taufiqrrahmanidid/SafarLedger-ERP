import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Landmark,
  PlaneTakeoff,
  Plus,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  Booking,
  ChartOfAccount,
  Departure,
  ErpTab,
  JournalEntry,
  Tenant,
  TravelPackage,
} from '../../types/erp';
import { formatIDR, formatShortDate } from '../../utils/formatters';
import { heroMakkahImg, resolvePackageImage } from '../../utils/packageImages';
import { HijriDateLine, RubElHizbMark } from '../IslamicOrnament';

interface DashboardViewProps {
  tenant: Tenant;
  coa: ChartOfAccount[];
  departures: Departure[];
  packages: TravelPackage[];
  bookings: Booking[];
  journals: JournalEntry[];
  expiredPassportCount: number;
  openIsoCount: number;
  onDispatchDeparture: (departureId: string) => void;
  onCreateDeparture: (input: {
    packageId: string;
    kloterCode: string;
    airline: string;
    departureDate: string;
    returnDate: string;
    totalSeats: number;
  }) => void;
  onNavigateTab: (tab: ErpTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  tenant,
  coa,
  departures,
  packages,
  bookings,
  journals,
  expiredPassportCount,
  openIsoCount,
  onDispatchDeparture,
  onCreateDeparture,
  onNavigateTab,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'DEPARTED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewKloterModal, setShowNewKloterModal] = useState(false);
  const [hoveredMonthIdx, setHoveredMonthIdx] = useState<number | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const currentYear = new Date().getFullYear();
  const defaultDepDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const defaultRetDate = new Date(Date.now() + 38 * 86400000).toISOString().slice(0, 10);

  const [newKloter, setNewKloter] = useState({
    packageId: packages[0]?.id || '',
    kloterCode: `KLT-${currentYear}-${String(departures.length + 1).padStart(2, '0')}A`,
    airline: 'Saudia Airlines (SV-819)',
    departureDate: defaultDepDate,
    returnDate: defaultRetDate,
    totalSeats: 45,
  });

  const nextDeparture = useMemo(
    () => departures.find((d) => d.status === 'OPEN' || d.status === 'FULL') || departures[0],
    [departures]
  );

  // Live SAK ETAP ledger calculations from real COA opening balances + journals
  const financialSummary = useMemo(() => {
    const cashOpening = coa
      .filter((c) => c.code === '1-101' || c.code === '1-102')
      .reduce((sum, c) => sum + c.openingBalance, 0);
    const unearnedOpening = coa.find((c) => c.code === '2-101')?.openingBalance || 0;
    const recognizedOpening = coa.find((c) => c.code === '4-101')?.openingBalance || 0;
    const hppOpening = coa.find((c) => c.code === '5-101')?.openingBalance || 0;

    let bankDelta = 0;
    let unearnedDelta = 0;
    let recognizedDelta = 0;
    let hppDelta = 0;

    for (const j of journals) {
      for (const l of j.lines) {
        if (l.accountCode === '1-101' || l.accountCode === '1-102') {
          bankDelta += l.debit - l.credit;
        }
        if (l.accountCode === '2-101') {
          unearnedDelta += l.credit - l.debit;
        }
        if (l.accountCode === '4-101') {
          recognizedDelta += l.credit - l.debit;
        }
        if (l.accountCode === '5-101') {
          hppDelta += l.debit - l.credit;
        }
      }
    }

    const cashBank = cashOpening + bankDelta;
    const unearnedLiability = unearnedOpening + unearnedDelta;
    const recognizedRevenue = recognizedOpening + recognizedDelta;
    const totalHpp = hppOpening + hppDelta;
    const grossMarginPct =
      recognizedRevenue > 0
        ? (((recognizedRevenue - totalHpp) / recognizedRevenue) * 100).toFixed(1)
        : '0.0';

    return {
      cashBank,
      unearnedLiability,
      recognizedRevenue,
      totalHpp,
      grossMarginPct,
    };
  }, [coa, journals]);

  const paidBookingsCount = bookings.filter((b) => b.status === 'PAID').length;
  const installmentCount = bookings.filter(
    (b) => b.status !== 'PAID' && b.status !== 'CANCELLED'
  ).length;

  const monthlySeries = useMemo(() => {
    const now = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const months: { key: string; label: string; year: number; inflow: number; recognized: number }[] = [];

    for (let offset = 4; offset >= 0; offset--) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      months.push({
        key: `${yyyy}-${mm}`,
        label: monthNames[d.getMonth()],
        year: yyyy,
        inflow: 0,
        recognized: 0,
      });
    }

    for (const j of journals) {
      const monthKey = j.date.slice(0, 7);
      const bucket = months.find((m) => m.key === monthKey);
      if (!bucket) continue;

      if (j.refType === 'PAYMENT') {
        for (const l of j.lines) {
          if (l.accountCode === '1-101' || l.accountCode === '1-102') {
            bucket.inflow += l.debit;
          }
        }
      } else if (j.refType === 'DEPARTURE_RECOGNITION') {
        for (const l of j.lines) {
          if (l.accountCode === '4-101') {
            bucket.recognized += l.credit - l.debit;
          }
        }
      }
    }

    return months;
  }, [journals]);

  const maxChartVal = Math.max(
    ...monthlySeries.map((m) => Math.max(m.inflow, m.recognized)),
    100000000
  );

  const filteredDepartures = useMemo(() => {
    return departures.filter((d) => {
      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'OPEN'
            ? d.status === 'OPEN' || d.status === 'FULL'
            : d.status === 'DEPARTED' || d.status === 'COMPLETED';
      const q = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !q ||
        d.kloterCode.toLowerCase().includes(q) ||
        d.packageName.toLowerCase().includes(q) ||
        d.airline.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [departures, statusFilter, searchQuery]);

  const handleSubmitKloter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKloter.packageId || !newKloter.kloterCode.trim()) return;
    onCreateDeparture(newKloter);
    setShowNewKloterModal(false);
    setNewKloter({
      packageId: packages[0]?.id || '',
      kloterCode: `KLT-${currentYear}-${String(departures.length + 2).padStart(2, '0')}A`,
      airline: 'Saudia Airlines (SV-819)',
      departureDate: defaultDepDate,
      returnDate: defaultRetDate,
      totalSeats: 45,
    });
  };

  return (
    <div className="space-y-6">
      {/* Executive Welcome Hero Split */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6 islamic-girih-light relative">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular">
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-900">
                <RubElHizbMark className="w-3.5 h-3.5 text-amber-600" />
                <span>{tenant.name}</span>
              </span>
              <span className="text-slate-300">·</span>
              <span>Izin PPIU {tenant.ppiu}</span>
              <span className="text-slate-300">·</span>
              <span>Izin PIHK {tenant.pihk}</span>
            </div>
            <h1 className="text-2xl sm:text-[27px] font-bold text-slate-900 font-display leading-snug text-balance">
              Pusat Kendali Operasional &amp; Keuangan Travel Haji &amp; Umrah
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pantau arus kas masuk jamaah, pengakuan pendapatan SAK ETAP per kloter, kesiapan visa paspor, dan margin keberangkatan secara real-time.
            </p>
            <div className="pt-0.5 text-[11px] font-medium text-amber-800/90">
              <HijriDateLine />
            </div>
          </div>

          <div className="space-y-4">
            <div className="gold-hairline-b" />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowNewKloterModal(true)}
                className="h-10 px-4 text-xs font-semibold text-white rounded-xl inline-flex items-center gap-1.5 shadow-xs transition-all duration-150 hover:opacity-95 whitespace-nowrap ring-1 ring-amber-300/30"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                <Plus className="w-4 h-4" />
                <span>Buat Kloter Baru</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('payments')}
                className="h-10 px-4 text-xs font-semibold bg-white border border-slate-200 text-slate-800 rounded-xl hover:bg-slate-50 transition-colors duration-150 whitespace-nowrap shadow-2xs"
              >
                Input Pembayaran Jamaah
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('accounting')}
                className="h-10 px-3 text-xs font-semibold text-emerald-900 hover:text-emerald-700 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Laporan Laba Rugi</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Visual Anchor Right Panel */}
        <div className="lg:col-span-5 relative min-h-[220px] lg:min-h-full bg-[#071D17] overflow-hidden">
          {!heroImgFailed ? (
            <img
              src={heroMakkahImg}
              alt="Arsitektur pelataran marmer nuansa Baitullah saat fajar"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
          ) : (
            <div
              className="w-full h-full lg:absolute lg:inset-0 islamic-girih-dark"
              style={{
                background: `linear-gradient(135deg, ${tenant.primaryColor} 0%, #051410 100%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#051410]/92 via-[#071D17]/40 to-transparent" />

          {nextDeparture && (
            <div className="relative lg:absolute inset-x-0 bottom-0 p-6 text-white space-y-1.5">
              <div className="text-[11px] font-medium text-amber-300 tabular">
                Keberangkatan Terdekat · {formatShortDate(nextDeparture.departureDate)}
              </div>
              <div className="text-base font-bold font-display leading-snug">
                {nextDeparture.kloterCode} — {nextDeparture.packageName}
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-100/85 tabular pt-1">
                <span>{nextDeparture.airline}</span>
                <span className="font-semibold text-white">
                  {nextDeparture.filledSeats} / {nextDeparture.totalSeats} Seat Terisi
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4-Column Modern KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 hover:border-emerald-900/20 transition-colors rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kas &amp; Bank Operasional</span>
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ring-1 ring-amber-300/30"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <Landmark className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3 tabular font-display tracking-tight">
            {formatIDR(financialSummary.cashBank)}
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular">
            Uang Muka Jamaah: <span className="font-semibold text-slate-800">{formatIDR(financialSummary.unearnedLiability)}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 hover:border-emerald-900/20 transition-colors rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pendapatan Diakui (SAK ETAP)</span>
            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3 tabular font-display tracking-tight">
            {formatIDR(financialSummary.recognizedRevenue)}
          </div>
          <div className="text-xs text-emerald-800 mt-2 tabular font-semibold">
            Margin Kotor Realisasi: {financialSummary.grossMarginPct}%
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 hover:border-emerald-900/20 transition-colors rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Jamaah Terdaftar</span>
            <span className="w-9 h-9 rounded-xl bg-amber-50/70 text-amber-800 border border-amber-200/70 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3 tabular font-display tracking-tight">
            {bookings.length} Jamaah
          </div>
          <div className="text-xs text-slate-500 mt-2 tabular">
            Lunas: <span className="font-semibold text-emerald-700">{paidBookingsCount}</span> · Cicilan/DP:{' '}
            <span className="font-semibold text-amber-700">{installmentCount}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 hover:border-emerald-900/20 transition-colors rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kepatuhan Paspor &amp; SLA</span>
            <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/70 flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3 tabular font-display tracking-tight">
            {expiredPassportCount + openIsoCount} Perlu Tindakan
          </div>
          <div className="text-xs mt-2 tabular flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('dms')}
              className="text-amber-700 hover:underline font-semibold"
            >
              {expiredPassportCount} Paspor &lt; 6 Bln
            </button>
            <span className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => onNavigateTab('agents')}
              className="text-red-700 hover:underline font-semibold"
            >
              {openIsoCount} SLA Terbuka
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Chart + Occupancy Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Arus Kas Masuk vs Pengakuan Pendapatan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan dana titipan jamaah yang masuk terhadap pendapatan resmi saat keberangkatan kloter.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 inline-block rounded-xs"
                  style={{ backgroundColor: tenant.primaryColor }}
                />
                Kas Masuk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 inline-block rounded-xs bg-slate-300" />
                Pendapatan Diakui
              </span>
            </div>
          </div>

          <div className="mt-5">
            <svg
              viewBox="0 0 600 185"
              className="w-full h-48 overflow-visible"
              role="img"
              aria-label="Grafik Arus Kas Bulanan"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 148 - ratio * 126;
                const valM = Math.round((maxChartVal * ratio) / 1000000);
                return (
                  <g key={idx}>
                    <line
                      x1="54"
                      y1={y}
                      x2="585"
                      y2={y}
                      stroke="#F1F5F9"
                      strokeWidth="1.5"
                    />
                    <text
                      x="46"
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-400 text-[10px] font-mono-code"
                    >
                      {valM} Jt
                    </text>
                  </g>
                );
              })}

              {monthlySeries.map((m, i) => {
                const groupX = 85 + i * 100;
                const hInflow = m.inflow > 0 ? Math.max(4, (m.inflow / maxChartVal) * 126) : 0;
                const hRec = m.recognized > 0 ? Math.max(4, (m.recognized / maxChartVal) * 126) : 0;
                const isHovered = hoveredMonthIdx === i;
                return (
                  <g
                    key={m.key}
                    onMouseEnter={() => setHoveredMonthIdx(i)}
                    onMouseLeave={() => setHoveredMonthIdx(null)}
                    className="cursor-pointer"
                  >
                    {isHovered && (
                      <rect
                        x={groupX - 8}
                        y="16"
                        width="72"
                        height="136"
                        rx="6"
                        fill="#F8FAFC"
                      />
                    )}
                    <rect
                      x={groupX}
                      y={148 - hInflow}
                      width="25"
                      height={hInflow}
                      rx="4"
                      fill={tenant.primaryColor}
                    />
                    <rect
                      x={groupX + 29}
                      y={148 - hRec}
                      width="25"
                      height={hRec}
                      rx="4"
                      fill="#CBD5E1"
                    />
                    <text
                      x={groupX + 27}
                      y="170"
                      textAnchor="middle"
                      className={`text-[11px] font-medium ${isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                        }`}
                    >
                      {m.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 tabular min-h-[24px]">
              {hoveredMonthIdx !== null ? (
                <>
                  <span className="font-semibold text-slate-900">
                    Periode {monthlySeries[hoveredMonthIdx].label} {monthlySeries[hoveredMonthIdx].year}
                  </span>
                  <span>
                    Kas Masuk:{' '}
                    <strong className="text-slate-900">
                      {formatIDR(monthlySeries[hoveredMonthIdx].inflow)}
                    </strong>{' '}
                    · Diakui:{' '}
                    <strong className="text-slate-900">
                      {formatIDR(monthlySeries[hoveredMonthIdx].recognized)}
                    </strong>
                  </span>
                </>
              ) : (
                <span className="text-slate-400">
                  Arahkan kursor ke batang grafik untuk melihat rincian nominal per bulan.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Okupansi Seat Kloter */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
          <div>
            <div className="pb-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Okupansi Seat Kloter
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Kapasitas berjalan</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('bookings')}
                className="text-xs font-semibold hover:underline"
                style={{ color: tenant.primaryColor }}
              >
                Lihat Manifes
              </button>
            </div>
            <div className="divide-y divide-slate-100 mt-1">
              {departures.slice(0, 4).map((d) => {
                const pct = Math.min(100, Math.round((d.filledSeats / d.totalSeats) * 100));
                return (
                  <div key={d.id} className="py-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono-code font-semibold text-slate-900">
                        {d.kloterCode}
                      </span>
                      <span className="tabular text-slate-600">
                        <strong className="text-slate-900">{d.filledSeats}</strong> / {d.totalSeats} seat ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor:
                            d.status === 'DEPARTED' ? '#16A34A' : tenant.primaryColor,
                        }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {d.packageName} · {formatShortDate(d.departureDate)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Featured Packages Commercial Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 font-display">
              Katalog Paket Unggulan Aktif
            </h2>
            <p className="text-xs text-slate-500">
              Produk perjalanan siap jual beserta estimasi tarif Quad dan akomodasi hotel resmi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('bookings')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-950 inline-flex items-center gap-1"
          >
            <span>Kelola Katalog</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {packages.slice(0, 3).map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  <img
                    src={resolvePackageImage(pkg.imageUrl, pkg.category)}
                    alt={pkg.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                  />
                </div>

                <div className="p-4 space-y-2">
                  <div className="text-[11px] font-medium text-slate-500 font-mono-code">
                    {pkg.code} · {pkg.category} · {pkg.durationDays} Hari
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 font-display leading-snug">
                    {pkg.name}
                  </h3>
                  <div className="text-xs text-slate-600 space-y-0.5 pt-1">
                    <div className="truncate">Makkah: {pkg.hotelMakkah}</div>
                    <div className="truncate">Madinah: {pkg.hotelMadinah}</div>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] text-slate-500">Mulai Quad</div>
                  <div className="text-sm font-bold text-slate-900 tabular font-display">
                    {formatIDR(pkg.priceQuad)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('bookings')}
                  className="h-8 px-3 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  Daftarkan Jamaah
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Jadwal Keberangkatan & Analisis Margin Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Jadwal Keberangkatan &amp; Analisis Margin per Kloter
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kode kloter / maskapai..."
                className="h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs w-52 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200/80">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'OPEN', label: 'Dibuka' },
                  { id: 'DEPARTED', label: 'Berangkat' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                <th className="py-3 px-5">Kode Kloter</th>
                <th className="py-3 px-4">Paket &amp; Maskapai</th>
                <th className="py-3 px-4">Tgl Berangkat</th>
                <th className="py-3 px-4 text-right">Terisi / Kuota</th>
                <th className="py-3 px-4 text-right">Omzet Kontrak</th>
                <th className="py-3 px-4 text-right">Est. HPP</th>
                <th className="py-3 px-4 text-right">Est. Margin</th>
                <th className="py-3 px-5 text-right">Status &amp; Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDepartures.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-500">
                    Tidak ada kloter yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredDepartures.map((d) => {
                  const kloterBookings = bookings.filter((b) => b.departureId === d.id);
                  const contractRevenue = kloterBookings.reduce((sum, b) => sum + b.totalAmount, 0);
                  const estHpp = d.filledSeats * d.estHppPerSeat;
                  const estMargin = contractRevenue - estHpp;

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-mono-code font-semibold text-slate-900 whitespace-nowrap">
                        {d.kloterCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{d.packageName}</div>
                        <div className="text-slate-500">{d.airline}</div>
                      </td>
                      <td className="py-3.5 px-4 tabular text-slate-700 whitespace-nowrap">
                        {formatShortDate(d.departureDate)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{d.filledSeats}</span> /{' '}
                        {d.totalSeats}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular font-medium text-slate-900 whitespace-nowrap">
                        {formatIDR(contractRevenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular text-slate-600 whitespace-nowrap">
                        {formatIDR(estHpp)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular font-semibold text-emerald-700 whitespace-nowrap">
                        {formatIDR(estMargin)}
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {d.status === 'OPEN' || d.status === 'FULL' ? (
                          <button
                            type="button"
                            onClick={() => onDispatchDeparture(d.id)}
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-slate-800 font-semibold shadow-2xs transition-colors duration-150"
                          >
                            <PlaneTakeoff className="w-3.5 h-3.5" />
                            Berangkatkan (Akui SAK ETAP)
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-semibold">
                            Berangkat · Jurnal Diakui
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Buat Kloter Baru */}
      {showNewKloterModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 font-display">
                Buat Jadwal Kloter Keberangkatan Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowNewKloterModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitKloter} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Paket Travel</label>
                <select
                  value={newKloter.packageId}
                  onChange={(e) => setNewKloter({ ...newKloter, packageId: e.target.value })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white focus:outline-none focus:border-slate-400"
                  required
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Kode Kloter</label>
                  <input
                    type="text"
                    required
                    value={newKloter.kloterCode}
                    onChange={(e) => setNewKloter({ ...newKloter, kloterCode: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 font-mono-code focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Kuota Seat</label>
                  <input
                    type="number"
                    min={10}
                    max={250}
                    required
                    value={newKloter.totalSeats}
                    onChange={(e) =>
                      setNewKloter({ ...newKloter, totalSeats: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Maskapai &amp; Nomor Penerbangan
                </label>
                <input
                  type="text"
                  required
                  value={newKloter.airline}
                  onChange={(e) => setNewKloter({ ...newKloter, airline: e.target.value })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 focus:outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Tanggal Berangkat</label>
                  <input
                    type="date"
                    required
                    value={newKloter.departureDate}
                    onChange={(e) => setNewKloter({ ...newKloter, departureDate: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Tanggal Pulang</label>
                  <input
                    type="date"
                    required
                    value={newKloter.returnDate}
                    onChange={(e) => setNewKloter({ ...newKloter, returnDate: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewKloterModal(false)}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-white font-semibold rounded-lg"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  Simpan Kloter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};