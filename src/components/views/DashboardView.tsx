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
  Departure,
  ErpTab,
  JournalEntry,
  Tenant,
  TravelPackage,
} from '../../types/erp';
import { formatIDR, formatShortDate } from '../../utils/formatters';

interface DashboardViewProps {
  tenant: Tenant;
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

const HERO_IMAGE_PATH = '/src/assets/images/hero_makkah_sanctuary_1794804833377.jpg';

export const DashboardView: React.FC<DashboardViewProps> = ({
  tenant,
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

  const [newKloter, setNewKloter] = useState({
    packageId: packages[0]?.id || '',
    kloterCode: `KLT-2027-0${departures.length + 2}A`,
    airline: 'Saudia Airlines (SV-819)',
    departureDate: '2027-02-14',
    returnDate: '2027-02-22',
    totalSeats: 45,
  });

  const nextDeparture = useMemo(
    () => departures.find((d) => d.status === 'OPEN' || d.status === 'FULL') || departures[0],
    [departures]
  );

  // Live SAK ETAP ledger calculations
  const financialSummary = useMemo(() => {
    const cashOpening = 455000000;
    let bankDelta = 0;
    let unearnedLiability = 0;
    let recognizedRevenue = 0;
    let totalHpp = 0;

    for (const j of journals) {
      for (const l of j.lines) {
        if (l.accountCode === '1-101' || l.accountCode === '1-102') {
          bankDelta += l.debit - l.credit;
        }
        if (l.accountCode === '2-101') {
          unearnedLiability += l.credit - l.debit;
        }
        if (l.accountCode === '4-101') {
          recognizedRevenue += l.credit - l.debit;
        }
        if (l.accountCode === '5-101') {
          totalHpp += l.debit - l.credit;
        }
      }
    }

    const cashBank = cashOpening + bankDelta;
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
  }, [journals]);

  const paidBookingsCount = bookings.filter((b) => b.status === 'PAID').length;
  const installmentCount = bookings.filter(
    (b) => b.status !== 'PAID' && b.status !== 'CANCELLED'
  ).length;

  const monthlySeries = useMemo(() => {
    const currentMonthInflow = bookings.reduce((sum, b) => sum + b.paidAmount, 0);
    return [
      { label: 'Jul', inflow: 320000000, recognized: 280000000 },
      { label: 'Agu', inflow: 540000000, recognized: 490000000 },
      { label: 'Sep', inflow: 680000000, recognized: 610000000 },
      { label: 'Okt', inflow: 1460000000, recognized: financialSummary.recognizedRevenue },
      { label: 'Nov', inflow: currentMonthInflow, recognized: 0 },
    ];
  }, [bookings, financialSummary.recognizedRevenue]);

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
      kloterCode: `KLT-2027-0${departures.length + 3}A`,
      airline: 'Saudia Airlines (SV-819)',
      departureDate: '2027-03-10',
      returnDate: '2027-03-18',
      totalSeats: 45,
    });
  };

  return (
    <div className="space-y-6">
      {/* Executive Welcome Hero Split */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-7 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <div className="text-xs font-medium text-slate-500 tabular">
              {tenant.name} · Izin PPIU {tenant.ppiu} · Izin PIHK {tenant.pihk}
            </div>
            <h1 className="text-2xl sm:text-[26px] font-bold text-slate-900 font-display leading-snug text-balance">
              Pusat Kendali Operasional &amp; Keuangan Travel Haji &amp; Umrah
            </h1>
            <p className="text-sm text-slate-600 max-w-2xl leading-relaxed">
              Pantau arus kas masuk jamaah, pengakuan pendapatan SAK ETAP per kloter, kesiapan visa paspor, dan margin keberangkatan secara real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowNewKloterModal(true)}
              className="h-10 px-4 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-all duration-150 hover:opacity-95 whitespace-nowrap"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <Plus className="w-4 h-4" />
              <span>Buat Kloter Baru</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('payments')}
              className="h-10 px-4 text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-lg hover:bg-slate-100 transition-colors duration-150 whitespace-nowrap"
            >
              Input Pembayaran Jamaah
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('accounting')}
              className="h-10 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Laporan Laba Rugi</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Visual Anchor Right Panel */}
        <div className="lg:col-span-5 relative min-h-[200px] lg:min-h-full bg-slate-900 overflow-hidden">
          {!heroImgFailed ? (
            <img
              src={HERO_IMAGE_PATH}
              alt="Arsitektur pelataran marmer nuansa Baitullah saat fajar"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover lg:absolute lg:inset-0"
            />
          ) : (
            <div
              className="w-full h-full lg:absolute lg:inset-0"
              style={{
                background: `linear-gradient(135deg, ${tenant.primaryColor} 0%, #0F172A 100%)`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/15" />

          {nextDeparture && (
            <div className="relative lg:absolute inset-x-0 bottom-0 p-5 text-white space-y-1.5">
              <div className="text-[11px] font-medium text-amber-300 tabular">
                Keberangkatan Terdekat · {formatShortDate(nextDeparture.departureDate)}
              </div>
              <div className="text-base font-bold font-display leading-snug">
                {nextDeparture.kloterCode} — {nextDeparture.packageName}
              </div>
              <div className="flex items-center justify-between text-xs text-slate-200 tabular pt-1">
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
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kas &amp; Bank Operasional</span>
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
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

        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pendapatan Diakui (SAK ETAP)</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-3 tabular font-display tracking-tight">
            {formatIDR(financialSummary.recognizedRevenue)}
          </div>
          <div className="text-xs text-emerald-700 mt-2 tabular font-semibold">
            Margin Kotor Realisasi: {financialSummary.grossMarginPct}%
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Jamaah Terdaftar</span>
            <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
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

        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Kepatuhan Paspor &amp; SLA</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
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
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
                const hInflow = Math.max(4, (m.inflow / maxChartVal) * 126);
                const hRec = m.recognized > 0 ? Math.max(4, (m.recognized / maxChartVal) * 126) : 0;
                const isHovered = hoveredMonthIdx === i;
                return (
                  <g
                    key={m.label}
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
                      className={`text-[11px] font-medium ${
                        isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
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
                    Periode {monthlySeries[hoveredMonthIdx].label} 2026
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
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex flex-col justify-between">
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
              className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:shadow-md transition-shadow duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  {pkg.imageUrl ? (
                    <img
                      src={pkg.imageUrl}
                      alt={pkg.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-white font-display font-semibold text-sm"
                      style={{
                        background: `linear-gradient(135deg, ${tenant.primaryColor} 0%, #1E293B 100%)`,
                      }}
                    >
                      {pkg.code}
                    </div>
                  )}
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
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
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
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap ${
                    statusFilter === tab.id
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
                  const contractRevenue =
                    d.status === 'DEPARTED' && kloterBookings.length === 0
                      ? 1460000000
                      : kloterBookings.reduce((sum, b) => sum + b.totalAmount, 0);
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
