import React, { useMemo, useState } from 'react';
import { Printer, Receipt, Search } from 'lucide-react';
import { Booking, PaymentMethod, PaymentRecord, Tenant } from '../../types/erp';
import { buildQrGrid, formatHijriDate, formatIDR, formatShortDate } from '../../utils/formatters';
import { RubElHizbMark } from '../IslamicOrnament';

interface PaymentsViewProps {
  tenant: Tenant;
  bookings: Booking[];
  payments: PaymentRecord[];
  onRecordPayment: (input: {
    bookingId: string;
    amount: number;
    method: PaymentMethod;
  }) => Promise<PaymentRecord | null> | PaymentRecord | null;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  BSI_VA: 'BSI Virtual Account (Open API)',
  XENDIT_VA: 'Xendit Virtual Account',
  MIDTRANS_VA: 'Midtrans Payment Gateway',
  BANK_TRANSFER: 'Transfer Bank Syariah Manual',
  CASH: 'Tunai Kasir Kantor',
};

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  tenant,
  bookings,
  payments,
  onRecordPayment,
}) => {
  const unpaidBookings = useMemo(
    () => bookings.filter((b) => b.paidAmount < b.totalAmount && b.status !== 'CANCELLED'),
    [bookings]
  );

  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    unpaidBookings[0]?.id || ''
  );
  const [amount, setAmount] = useState<number>(10000000);
  const [method, setMethod] = useState<PaymentMethod>('BSI_VA');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string>(payments[0]?.id || '');
  const [submitting, setSubmitting] = useState(false);

  const activeBookingId = unpaidBookings.some((b) => b.id === selectedBookingId)
    ? selectedBookingId
    : unpaidBookings[0]?.id || '';

  const activeBooking = unpaidBookings.find((b) => b.id === activeBookingId);
  const remainingDue = activeBooking
    ? activeBooking.totalAmount - activeBooking.paidAmount
    : 0;

  const selectedReceipt =
    payments.find((p) => p.id === selectedReceiptId) || payments[0] || null;

  const qrCells = useMemo(
    () => (selectedReceipt ? buildQrGrid(selectedReceipt.qrHash + selectedReceipt.receiptNo) : []),
    [selectedReceipt]
  );

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter(
      (p) =>
        p.receiptNo.toLowerCase().includes(q) ||
        p.jamaahName.toLowerCase().includes(q) ||
        p.bookingNo.toLowerCase().includes(q)
    );
  }, [payments, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBookingId || amount <= 0 || submitting) return;
    setSubmitting(true);
    try {
      const created = await onRecordPayment({
        bookingId: activeBookingId,
        amount,
        method,
      });
      if (created) {
        setSelectedReceiptId(created.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-xl font-bold text-slate-900 font-display">
          Kasir, Pembayaran Jamaah &amp; Kuitansi QR Resmi
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Verifikasi pembayaran DP maupun angsuran otomatis menerbitkan Kuitansi QR dan menjurnal ke Akun 2-101 Uang Muka Jamaah (SAK ETAP).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Terima Pembayaran */}
        <div className="no-print bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Terima Pembayaran / Angsuran
            </h2>
          </div>

          {unpaidBookings.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Seluruh booking jamaah saat ini berstatus Lunas.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Booking Jamaah (Belum Lunas)
                </label>
                <select
                  value={activeBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  required
                >
                  {unpaidBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bookingNo} — {b.jamaahName} (Sisa {formatIDR(b.totalAmount - b.paidAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {activeBooking && (
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1.5 tabular">
                  <div className="flex justify-between text-slate-600">
                    <span>Total Kontrak ({activeBooking.kloterCode})</span>
                    <span className="font-semibold text-slate-900">
                      {formatIDR(activeBooking.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Sudah Dibayar</span>
                    <span className="font-semibold text-emerald-700">
                      {formatIDR(activeBooking.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900">
                    <span>Sisa Tagihan</span>
                    <span>{formatIDR(remainingDue)}</span>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-medium">Nominal Pembayaran (Rp)</label>
                  {remainingDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(remainingDue)}
                      className="text-[11px] font-semibold underline text-slate-700 hover:text-slate-950"
                    >
                      Lunasi Penuh
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={100000}
                  max={remainingDue || undefined}
                  step={100000}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 tabular bg-slate-50/50 focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Kanal Pembayaran</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 text-xs font-semibold text-white rounded-lg shadow-xs transition-opacity duration-150 hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {submitting ? 'Memproses Pembayaran...' : 'Verifikasi & Auto-Journal SAK ETAP'}
              </button>
            </form>
          )}
        </div>

        {/* Riwayat Pembayaran & Preview Kuitansi Resmi */}
        <div className="lg:col-span-2 space-y-5">
          {selectedReceipt && (
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
              <div className="islamic-girih-light px-6 py-5 border-b border-amber-500/20 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-emerald-900">
                    <RubElHizbMark className="w-3.5 h-3.5 text-amber-600" />
                    <span>Kuitansi Pembayaran Syariah Resmi</span>
                  </div>
                  <div className="text-base font-bold text-slate-900 font-display">
                    {tenant.name}
                  </div>
                  <div className="text-xs text-slate-500 tabular">
                    Izin PPIU {tenant.ppiu} · Izin PIHK {tenant.pihk}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs tabular">
                    <div className="font-mono-code font-semibold text-slate-900">
                      {selectedReceipt.receiptNo}
                    </div>
                    <div className="text-slate-600">{formatShortDate(selectedReceipt.date)}</div>
                    <div className="text-[11px] text-amber-800/90">
                      {formatHijriDate(selectedReceipt.date)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print h-9 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-50 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Cetak
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between gap-5 items-start sm:items-center">
                  <div className="space-y-2 text-xs flex-1">
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-500">Diterima Dari</span>
                      <span className="col-span-2 font-semibold text-slate-900">
                        {selectedReceipt.jamaahName}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-500">Nomor Booking</span>
                      <span className="col-span-2 font-mono-code text-slate-800">
                        {selectedReceipt.bookingNo}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-slate-500">Metode Bayar</span>
                      <span className="col-span-2 text-slate-800">
                        {METHOD_LABELS[selectedReceipt.method]}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Nominal Diterima</span>
                      <span className="col-span-2 text-lg font-bold tabular text-slate-900 font-display">
                        {formatIDR(selectedReceipt.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center p-3 border border-amber-500/25 rounded-xl bg-slate-50/70 shrink-0">
                    <svg
                      width="64"
                      height="64"
                      viewBox="0 0 9 9"
                      shapeRendering="crispEdges"
                      role="img"
                      aria-label={`QR Verifikasi ${selectedReceipt.receiptNo}`}
                    >
                      <rect width="9" height="9" fill="#FFFFFF" />
                      {qrCells.map((filled, idx) =>
                        filled ? (
                          <rect
                            key={idx}
                            x={idx % 9}
                            y={Math.floor(idx / 9)}
                            width="1"
                            height="1"
                            fill="#0B3B2D"
                          />
                        ) : null
                      )}
                    </svg>
                    <span className="text-[10px] font-mono-code text-slate-500 mt-1.5">
                      {selectedReceipt.qrHash}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Riwayat Kuitansi Table */}
          <div className="no-print bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900 font-display">
                  Riwayat Penerimaan Kas &amp; Bank
                </h2>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kuitansi / jamaah..."
                  className="h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs w-48 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                    <th className="py-3 px-4">No. Kuitansi</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3">Jamaah &amp; Booking</th>
                    <th className="py-3 px-3">Kanal</th>
                    <th className="py-3 px-3 text-right">Nominal</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 transition-colors ${selectedReceipt?.id === p.id ? 'bg-slate-50' : ''
                        }`}
                    >
                      <td className="py-3 px-4 font-mono-code font-semibold text-slate-900 whitespace-nowrap">
                        {p.receiptNo}
                      </td>
                      <td className="py-3 px-3 tabular text-slate-600 whitespace-nowrap">
                        {formatShortDate(p.date)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{p.jamaahName}</div>
                        <div className="font-mono-code text-[11px] text-slate-500">{p.bookingNo}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{p.method}</td>
                      <td className="py-3 px-3 text-right tabular font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptId(p.id)}
                          className="text-xs font-semibold underline text-slate-700 hover:text-slate-950"
                        >
                          Pratinjau Kuitansi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};