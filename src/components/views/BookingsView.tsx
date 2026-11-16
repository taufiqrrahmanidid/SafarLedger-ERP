import React, { useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, Plus, Search } from 'lucide-react';
import {
  Agent,
  Booking,
  Departure,
  PackageCategory,
  RoomType,
  Tenant,
  TravelPackage,
} from '../../types/erp';
import { formatIDR } from '../../utils/formatters';

interface BookingsViewProps {
  tenant: Tenant;
  packages: TravelPackage[];
  departures: Departure[];
  bookings: Booking[];
  agents: Agent[];
  onCreateBooking: (input: {
    jamaahName: string;
    nikRaw: string;
    phone: string;
    gender: 'L' | 'P';
    departureId: string;
    roomType: RoomType;
    mahramGroup: string;
    agentId: string;
    passportNo: string;
    passportExpiry: string;
  }) => void;
  onUpdateRooming: (bookingId: string, roomNumber: string, mahramGroup: string) => void;
  onCreatePackage: (input: {
    code: string;
    name: string;
    category: PackageCategory;
    durationDays: number;
    priceQuad: number;
    priceTriple: number;
    priceDouble: number;
    hppEstimate: number;
    hotelMakkah: string;
    hotelMadinah: string;
  }) => void;
}

export const BookingsView: React.FC<BookingsViewProps> = ({
  tenant,
  packages,
  departures,
  bookings,
  agents,
  onCreateBooking,
  onUpdateRooming,
  onCreatePackage,
}) => {
  const [subView, setSubView] = useState<'manifest' | 'packages'>('manifest');
  const [kloterFilter, setKloterFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    jamaahName: '',
    nikRaw: '',
    phone: '',
    gender: 'L' as 'L' | 'P',
    departureId: departures.find((d) => d.status === 'OPEN')?.id || departures[0]?.id || '',
    roomType: 'QUAD' as RoomType,
    mahramGroup: '',
    agentId: '',
    passportNo: '',
    passportExpiry: '2029-06-15',
  });

  const [pkgForm, setPkgForm] = useState({
    code: '',
    name: '',
    category: 'UMRAH' as PackageCategory,
    durationDays: 9,
    priceQuad: 29000000,
    priceTriple: 31500000,
    priceDouble: 35000000,
    hppEstimate: 24000000,
    hotelMakkah: 'Swissôtel Makkah (★5)',
    hotelMadinah: 'Pullman Zamzam Madinah (★5)',
  });

  const selectedDeparture = departures.find((d) => d.id === form.departureId);
  const selectedPackage = packages.find((p) => p.id === selectedDeparture?.packageId);

  const estimatedPrice = useMemo(() => {
    if (!selectedPackage) return 28500000;
    if (form.roomType === 'DOUBLE') return selectedPackage.priceDouble;
    if (form.roomType === 'TRIPLE') return selectedPackage.priceTriple;
    return selectedPackage.priceQuad;
  }, [selectedPackage, form.roomType]);

  const roomConflicts = useMemo(() => {
    const rooms = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!b.roomNumber || b.roomNumber === 'TBD') continue;
      const key = `${b.kloterCode}::${b.roomNumber}`;
      const list = rooms.get(key) || [];
      list.push(b);
      rooms.set(key, list);
    }

    const alerts: string[] = [];
    rooms.forEach((occupants, key) => {
      const genders = new Set(occupants.map((o) => o.gender));
      if (genders.size > 1) {
        const mahramGroups = new Set(occupants.map((o) => o.mahramGroup).filter(Boolean));
        if (mahramGroups.size !== 1 || occupants.some((o) => !o.mahramGroup)) {
          alerts.push(
            `Kamar ${key.replace('::', ' #')} berisi campuran L/P tanpa kesamaan Grup Mahram.`
          );
        }
      }
      const capacityMap: Record<RoomType, number> = { QUAD: 4, TRIPLE: 3, DOUBLE: 2 };
      const maxCap = capacityMap[occupants[0].roomType];
      if (occupants.length > maxCap) {
        alerts.push(
          `Kamar ${key.replace('::', ' #')} (${occupants[0].roomType}) kelebihan kapasitas (${occupants.length}/${maxCap}).`
        );
      }
    });
    return alerts;
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchKloter = kloterFilter === 'ALL' || b.departureId === kloterFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        b.jamaahName.toLowerCase().includes(q) ||
        b.bookingNo.toLowerCase().includes(q) ||
        b.roomNumber.toLowerCase().includes(q) ||
        b.mahramGroup.toLowerCase().includes(q);
      return matchKloter && matchSearch;
    });
  }, [bookings, kloterFilter, searchQuery]);

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jamaahName.trim() || !form.departureId) return;
    onCreateBooking(form);
    setForm((prev) => ({
      ...prev,
      jamaahName: '',
      nikRaw: '',
      phone: '',
      mahramGroup: '',
      passportNo: '',
    }));
  };

  const handleSubmitPackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgForm.code.trim() || !pkgForm.name.trim()) return;
    onCreatePackage(pkgForm);
    setPkgForm((prev) => ({ ...prev, code: '', name: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            Manifes Jamaah, Rooming List &amp; Katalog Paket
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Registrasi jamaah multi-tier (Quad/Triple/Double), pengelompokan mahram, dan alokasi kamar hotel Makkah/Madinah.
          </p>
        </div>

        <div className="flex items-center p-1 bg-slate-200/70 rounded-lg border border-slate-200 shrink-0 self-start">
          <button
            type="button"
            onClick={() => setSubView('manifest')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap ${
              subView === 'manifest'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manifes &amp; Rooming List ({bookings.length})
          </button>
          <button
            type="button"
            onClick={() => setSubView('packages')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap ${
              subView === 'packages'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Katalog Paket &amp; HPP ({packages.length})
          </button>
        </div>
      </div>

      {subView === 'manifest' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Registration Form */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Registrasi Jamaah Baru
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Otomatis membuat invoice, antrean DMS, dan akrual komisi agen.
              </p>
            </div>
            <form onSubmit={handleSubmitBooking} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Nama Lengkap (Sesuai Paspor)
                </label>
                <input
                  type="text"
                  required
                  value={form.jamaahName}
                  onChange={(e) => setForm({ ...form, jamaahName: e.target.value })}
                  placeholder="Contoh: Hj. Siti Aminah"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    NIK KTP (Enkripsi)
                  </label>
                  <input
                    type="text"
                    required
                    value={form.nikRaw}
                    onChange={(e) => setForm({ ...form, nikRaw: e.target.value })}
                    placeholder="327301..."
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 font-mono-code bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">No. WhatsApp</label>
                  <input
                    type="text"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0812..."
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 tabular bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Jenis Kelamin</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value as 'L' | 'P' })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Grup Mahram</label>
                  <input
                    type="text"
                    value={form.mahramGroup}
                    onChange={(e) =>
                      setForm({ ...form, mahramGroup: e.target.value.toUpperCase() })
                    }
                    placeholder="MHR-08"
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 font-mono-code bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Kloter Keberangkatan
                </label>
                <select
                  value={form.departureId}
                  onChange={(e) => setForm({ ...form, departureId: e.target.value })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  required
                >
                  {departures
                    .filter((d) => d.status === 'OPEN')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.kloterCode} — {d.packageName} ({d.totalSeats - d.filledSeats} sisa)
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Tipe Kamar</label>
                  <select
                    value={form.roomType}
                    onChange={(e) => setForm({ ...form, roomType: e.target.value as RoomType })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    <option value="QUAD">Quad (Ber-4)</option>
                    <option value="TRIPLE">Triple (Ber-3)</option>
                    <option value="DOUBLE">Double (Ber-2)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Agen Perujuk</label>
                  <select
                    value={form.agentId}
                    onChange={(e) => setForm({ ...form, agentId: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    <option value="">Direct Office</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    No. Paspor (Opsional)
                  </label>
                  <input
                    type="text"
                    value={form.passportNo}
                    onChange={(e) =>
                      setForm({ ...form, passportNo: e.target.value.toUpperCase() })
                    }
                    placeholder="C8812..."
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 font-mono-code bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Exp. Paspor</label>
                  <input
                    type="date"
                    value={form.passportExpiry}
                    onChange={(e) => setForm({ ...form, passportExpiry: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between">
                <span className="text-slate-600 font-medium">Total Tagihan Paket:</span>
                <span className="font-bold text-slate-900 tabular text-sm font-display">
                  {formatIDR(estimatedPrice)}
                </span>
              </div>

              <button
                type="submit"
                className="w-full h-10 text-xs font-semibold text-white rounded-lg shadow-xs transition-opacity duration-150 hover:opacity-95"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                Simpan Pendaftaran &amp; Terbitkan Invoice
              </button>
            </form>
          </div>

          {/* Manifest & Rooming Table */}
          <div className="lg:col-span-2 space-y-4">
            {roomConflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Peringatan Validasi Rooming List &amp; Mahram</span>
                </div>
                {roomConflicts.map((msg, i) => (
                  <div key={i} className="pl-5 text-amber-800">
                    {msg}
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <BedDouble className="w-4 h-4 text-slate-500" />
                  <h2 className="text-sm font-semibold text-slate-900 font-display">
                    Manifes Jamaah &amp; Alokasi Kamar
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari nama / kamar / mahram..."
                      className="h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs w-44 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <select
                    value={kloterFilter}
                    onChange={(e) => setKloterFilter(e.target.value)}
                    className="h-8 border border-slate-200 rounded-lg px-2.5 text-xs bg-white"
                  >
                    <option value="ALL">Semua Kloter</option>
                    {departures.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.kloterCode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                      <th className="py-3 px-4">Booking &amp; Jamaah</th>
                      <th className="py-3 px-3">Kloter</th>
                      <th className="py-3 px-3">Kamar</th>
                      <th className="py-3 px-3">Mahram</th>
                      <th className="py-3 px-3 text-right">Tagihan</th>
                      <th className="py-3 px-3 text-right">Terbayar</th>
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBookings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-500">
                          Belum ada data jamaah pada filter yang dipilih.
                        </td>
                      </tr>
                    ) : (
                      filteredBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900">
                              {b.jamaahName} ({b.gender})
                            </div>
                            <div className="font-mono-code text-[11px] text-slate-500">
                              {b.bookingNo} · NIK {b.nikMasked}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono-code text-slate-700 whitespace-nowrap">
                            {b.kloterCode}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">{b.roomType}</span>
                              <input
                                type="text"
                                aria-label={`Nomor kamar ${b.jamaahName}`}
                                value={b.roomNumber}
                                onChange={(e) =>
                                  onUpdateRooming(b.id, e.target.value, b.mahramGroup)
                                }
                                className="w-14 h-7 px-2 border border-slate-200 rounded-md font-mono-code text-xs bg-white focus:outline-none focus:border-slate-500"
                              />
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <input
                              type="text"
                              aria-label={`Grup mahram ${b.jamaahName}`}
                              value={b.mahramGroup}
                              placeholder="-"
                              onChange={(e) =>
                                onUpdateRooming(b.id, b.roomNumber, e.target.value.toUpperCase())
                              }
                              className="w-16 h-7 px-2 border border-slate-200 rounded-md font-mono-code text-xs bg-white focus:outline-none focus:border-slate-500"
                            />
                          </td>
                          <td className="py-3 px-3 text-right tabular whitespace-nowrap">
                            {formatIDR(b.totalAmount)}
                          </td>
                          <td className="py-3 px-3 text-right tabular font-semibold whitespace-nowrap text-slate-900">
                            {formatIDR(b.paidAmount)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {b.status === 'PAID' ? (
                              <span className="text-emerald-700 font-semibold">Lunas</span>
                            ) : b.status === 'INSTALLMENT' ? (
                              <span className="text-amber-700 font-semibold">Cicilan</span>
                            ) : (
                              <span className="text-red-700 font-semibold">Menunggu DP</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Visual Package Catalog & Add Form */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
            <h2 className="text-sm font-semibold text-slate-900 font-display border-b border-slate-100 pb-3">
              Tambah Master Paket Baru
            </h2>
            <form onSubmit={handleSubmitPackage} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Kode Paket</label>
                  <input
                    type="text"
                    required
                    value={pkgForm.code}
                    onChange={(e) => setPkgForm({ ...pkgForm, code: e.target.value.toUpperCase() })}
                    placeholder="UMR-VIP-9H"
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Kategori</label>
                  <select
                    value={pkgForm.category}
                    onChange={(e) =>
                      setPkgForm({ ...pkgForm, category: e.target.value as PackageCategory })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2 bg-white"
                  >
                    <option value="UMRAH">Umrah</option>
                    <option value="HAJI_PLUS">Haji Khusus</option>
                    <option value="FURODA">Haji Furoda</option>
                    <option value="WISATA_HALAL">Wisata Halal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nama Paket</label>
                <input
                  type="text"
                  required
                  value={pkgForm.name}
                  onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                  placeholder="Umrah Ramadhan Akhir 12 Hari"
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Durasi (Hari)</label>
                  <input
                    type="number"
                    min={3}
                    max={45}
                    value={pkgForm.durationDays}
                    onChange={(e) =>
                      setPkgForm({ ...pkgForm, durationDays: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Est. HPP / Pax</label>
                  <input
                    type="number"
                    step={500000}
                    value={pkgForm.hppEstimate}
                    onChange={(e) =>
                      setPkgForm({ ...pkgForm, hppEstimate: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Quad</label>
                  <input
                    type="number"
                    step={500000}
                    value={pkgForm.priceQuad}
                    onChange={(e) => setPkgForm({ ...pkgForm, priceQuad: Number(e.target.value) })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2 tabular"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Triple</label>
                  <input
                    type="number"
                    step={500000}
                    value={pkgForm.priceTriple}
                    onChange={(e) =>
                      setPkgForm({ ...pkgForm, priceTriple: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2 tabular"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Double</label>
                  <input
                    type="number"
                    step={500000}
                    value={pkgForm.priceDouble}
                    onChange={(e) =>
                      setPkgForm({ ...pkgForm, priceDouble: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2 tabular"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Hotel Makkah</label>
                  <input
                    type="text"
                    value={pkgForm.hotelMakkah}
                    onChange={(e) => setPkgForm({ ...pkgForm, hotelMakkah: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Hotel Madinah</label>
                  <input
                    type="text"
                    value={pkgForm.hotelMadinah}
                    onChange={(e) => setPkgForm({ ...pkgForm, hotelMadinah: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full h-10 text-xs font-semibold text-white rounded-lg inline-flex items-center justify-center gap-1.5 shadow-xs"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                Simpan Paket Travel
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 h-fit">
            {packages.map((p) => {
              const estMarginQuad = p.priceQuad - p.hppEstimate;
              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-display font-bold text-base"
                          style={{
                            background: `linear-gradient(135deg, ${tenant.primaryColor} 0%, #0F172A 100%)`,
                          }}
                        >
                          {p.code}
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-2.5">
                      <div className="text-[11px] font-mono-code text-slate-500">
                        {p.code} · {p.category} · {p.durationDays} Hari
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 font-display leading-snug">
                        {p.name}
                      </h3>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <div>Makkah: {p.hotelMakkah}</div>
                        <div>Madinah: {p.hotelMadinah}</div>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/70 space-y-1.5 text-xs tabular">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Quad / Triple / Double</span>
                      <span className="font-semibold text-slate-900">
                        {formatIDR(p.priceQuad)} · {formatIDR(p.priceTriple)} · {formatIDR(p.priceDouble)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Est. HPP &amp; Margin Quad</span>
                      <span className="text-emerald-700 font-semibold">
                        HPP {formatIDR(p.hppEstimate)} · +{formatIDR(estMarginQuad)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
