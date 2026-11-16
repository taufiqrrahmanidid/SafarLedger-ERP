import React, { useMemo, useState } from 'react';
import { Layers, PackageCheck, Plus } from 'lucide-react';
import { Booking, InventoryItem, Tenant } from '../../types/erp';
import { formatIDR } from '../../utils/formatters';

interface InventoryViewProps {
  tenant: Tenant;
  inventory: InventoryItem[];
  bookings: Booking[];
  onAssembleBundle: (quantity: number) => void;
  onRestockItem: (itemId: string, addQty: number) => void;
  onDispatchKitToJamaah: (bookingId: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  tenant,
  inventory,
  bookings,
  onAssembleBundle,
  onRestockItem,
  onDispatchKitToJamaah,
}) => {
  const [bundleQty, setBundleQty] = useState(10);

  const totalAssetValue = useMemo(
    () => inventory.reduce((sum, item) => sum + item.qty * item.avgCost, 0),
    [inventory]
  );

  const bundleItem = inventory.find((i) => i.isBundle);
  const componentItems = inventory.filter((i) => !i.isBundle);
  const canAssemble = componentItems.every((c) => c.qty >= bundleQty);

  const pendingKitBookings = bookings.filter((b) => !b.kitDispatched);
  const dispatchedKitBookings = bookings.filter((b) => b.kitDispatched);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            Persediaan Gudang &amp; Bundling Perlengkapan Umrah
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pelacakan stok eceran (koper, ihram, mukena, buku doa), perakitan set paket (assembly), dan serah terima ke jamaah.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center border border-slate-200 rounded-lg bg-white h-9 overflow-hidden shadow-2xs">
            <input
              type="number"
              min={1}
              max={50}
              value={bundleQty}
              onChange={(e) => setBundleQty(Math.max(1, Number(e.target.value)))}
              aria-label="Jumlah paket untuk dirakit"
              className="w-14 h-full px-2 text-xs tabular text-center focus:outline-none"
            />
            <button
              type="button"
              disabled={!canAssemble}
              onClick={() => onAssembleBundle(bundleQty)}
              className="h-full px-3.5 text-xs font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <Layers className="w-3.5 h-3.5" />
              Rakit {bundleQty} Paket (Assembly)
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="text-xs font-medium text-slate-500">Total Nilai Aset Persediaan (1-104)</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 tabular font-display">
            {formatIDR(totalAssetValue)}
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="text-xs font-medium text-slate-500">Paket Perlengkapan Siap Serah</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 tabular font-display">
            {bundleItem?.qty || 0} Set
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="text-xs font-medium text-slate-500">Status Serah Terima Jamaah</div>
          <div className="text-2xl font-bold text-slate-900 mt-2 tabular font-display">
            {dispatchedKitBookings.length} / {bookings.length} Jamaah
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 font-display">
            Stok Komponen &amp; Paket Perlengkapan
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                <th className="py-3 px-5">SKU</th>
                <th className="py-3 px-4">Nama Barang / Set Bundle</th>
                <th className="py-3 px-4">Lokasi Gudang</th>
                <th className="py-3 px-4 text-right">Stok Tersedia</th>
                <th className="py-3 px-4 text-right">HPP Rata-Rata</th>
                <th className="py-3 px-4 text-right">Nilai Aset</th>
                <th className="py-3 px-5 text-right">Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory.map((item) => {
                const isLow = item.qty < item.minStock;
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-5 font-mono-code text-slate-600 whitespace-nowrap">
                      {item.sku}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900">{item.name}</span>
                      {item.isBundle && (
                        <span className="ml-2 text-[11px] text-slate-500">· Bundle Assembly</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">{item.warehouse}</td>
                    <td
                      className={`py-3.5 px-4 text-right tabular font-semibold whitespace-nowrap ${
                        isLow ? 'text-red-700' : 'text-slate-900'
                      }`}
                    >
                      {item.qty} pcs {isLow ? '(Minimum)' : ''}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular whitespace-nowrap">
                      {formatIDR(item.avgCost)}
                    </td>
                    <td className="py-3.5 px-4 text-right tabular font-semibold whitespace-nowrap">
                      {formatIDR(item.qty * item.avgCost)}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {!item.isBundle ? (
                        <button
                          type="button"
                          onClick={() => onRestockItem(item.id, 20)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white rounded-lg text-xs font-medium hover:bg-slate-50 text-slate-800 shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          20 pcs
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Via Assembly</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Serah Terima Perlengkapan Jamaah */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Antrean Serah Terima Koper &amp; Perlengkapan Jamaah
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular">
            {pendingKitBookings.length} Jamaah Belum Menerima
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                <th className="py-3 px-5">No. Booking &amp; Jamaah</th>
                <th className="py-3 px-4">Kloter</th>
                <th className="py-3 px-4">Status Pembayaran</th>
                <th className="py-3 px-5 text-right">Status Perlengkapan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-5">
                    <span className="font-semibold text-slate-900">{b.jamaahName}</span>
                    <span className="ml-2 font-mono-code text-[11px] text-slate-500">
                      {b.bookingNo}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono-code text-slate-700">{b.kloterCode}</td>
                  <td className="py-3 px-4 tabular text-slate-700">
                    {formatIDR(b.paidAmount)} / {formatIDR(b.totalAmount)}
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    {b.kitDispatched ? (
                      <span className="text-emerald-700 font-semibold">Sudah Diserahkan</span>
                    ) : (
                      <button
                        type="button"
                        disabled={!bundleItem || bundleItem.qty < 1}
                        onClick={() => onDispatchKitToJamaah(b.id)}
                        className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 shadow-2xs"
                      >
                        Serahkan 1 Set Perlengkapan
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
