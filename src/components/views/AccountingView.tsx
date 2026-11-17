import React, { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  ChartOfAccount,
  Departure,
  JournalEntry,
  JournalRefType,
  Tenant,
} from '../../types/erp';
import { formatIDR, formatShortDate } from '../../utils/formatters';

interface AccountingViewProps {
  tenant: Tenant;
  coa: ChartOfAccount[];
  journals: JournalEntry[];
  departures: Departure[];
  onRecordExpense: (input: {
    description: string;
    expenseAccountCode: string;
    paymentAccountCode: string;
    amount: number;
    kloterCode?: string;
  }) => void;
}

export const AccountingView: React.FC<AccountingViewProps> = ({
  tenant,
  coa,
  journals,
  departures,
  onRecordExpense,
}) => {
  const [refFilter, setRefFilter] = useState<'ALL' | JournalRefType>('ALL');
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    expenseAccountCode: '5-101',
    paymentAccountCode: '1-102',
    amount: 25000000,
    kloterCode: departures[0]?.kloterCode || '',
  });

  const coaBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of coa) {
      map.set(acc.code, acc.openingBalance);
    }
    for (const j of journals) {
      for (const line of j.lines) {
        const acc = coa.find((c) => c.code === line.accountCode);
        const prev = map.get(line.accountCode) || 0;
        if (acc?.normalBalance === 'DEBIT') {
          map.set(line.accountCode, prev + line.debit - line.credit);
        } else {
          map.set(line.accountCode, prev + line.credit - line.debit);
        }
      }
    }
    return map;
  }, [coa, journals]);

  const getBal = (code: string) => coaBalances.get(code) || 0;

  const revenue = getBal('4-101');
  const cogs = getBal('5-101');
  const commissionExp = getBal('5-201');
  const officeExp = getBal('5-301');
  const netProfit = revenue - cogs - commissionExp - officeExp;

  const totalAssets =
    getBal('1-101') + getBal('1-102') + getBal('1-104') + getBal('1-105');
  const totalLiabilities = getBal('2-101') + getBal('2-102');
  const totalEquity = getBal('3-101') + netProfit;

  const ledgerTotals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const j of journals) {
      for (const l of j.lines) {
        debit += l.debit;
        credit += l.credit;
      }
    }
    return { debit, credit, isBalanced: debit === credit };
  }, [journals]);

  const filteredJournals = useMemo(() => {
    if (refFilter === 'ALL') return journals;
    return journals.filter((j) => j.refType === refFilter);
  }, [journals, refFilter]);

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) return;
    onRecordExpense(expenseForm);
    setShowExpenseModal(false);
    setExpenseForm((prev) => ({ ...prev, description: '' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            Akuntansi Keuangan (SAK ETAP Travel Umrah &amp; Haji)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Laporan Laba Rugi, Neraca berimbang otomatis, Saldo COA, dan Buku Besar Jurnal Double-Entry.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowExpenseModal(true)}
          className="h-9 px-4 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs self-start"
          style={{ backgroundColor: tenant.primaryColor }}
        >
          <Plus className="w-3.5 h-3.5" />
          Catat Beban / Bayar Vendor
        </button>
      </div>

      {/* Profit & Loss and Balance Sheet Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Laporan Laba Rugi (Profit &amp; Loss)
            </h2>
            <span className="text-xs text-slate-500">Periode Berjalan {new Date().getFullYear()}</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">4-101 Pendapatan Paket Umrah &amp; Haji</span>
              <span className="tabular font-semibold text-slate-900">{formatIDR(revenue)}</span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">5-101 Beban Pokok Penjualan (Tiket, Hotel, Visa)</span>
              <span className="tabular text-red-700">({formatIDR(cogs)})</span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">5-201 Beban Komisi Agen &amp; Marketing</span>
              <span className="tabular text-red-700">({formatIDR(commissionExp)})</span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">5-301 Beban Operasional Kantor &amp; SDM</span>
              <span className="tabular text-red-700">({formatIDR(officeExp)})</span>
            </div>
            <div className="px-5 py-3.5 flex justify-between bg-slate-50/80 font-bold text-slate-900 text-sm">
              <span>Laba Bersih Operasional</span>
              <span className={`tabular ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatIDR(netProfit)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Neraca Ringkas (Balance Sheet)
            </h2>
            <span className="text-xs text-emerald-700 font-semibold tabular">
              {ledgerTotals.isBalanced ? 'Neraca Seimbang (Balanced)' : 'Periksa Selisih'}
            </span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">1-101 / 1-102 Kas &amp; Bank Operasional</span>
              <span className="tabular font-semibold text-slate-900">
                {formatIDR(getBal('1-101') + getBal('1-102'))}
              </span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">1-104 Persediaan &amp; 1-105 DP Vendor</span>
              <span className="tabular font-semibold text-slate-900">
                {formatIDR(getBal('1-104') + getBal('1-105'))}
              </span>
            </div>
            <div className="px-5 py-3 flex justify-between bg-slate-50/50 font-semibold text-slate-900">
              <span>Total Aset</span>
              <span className="tabular">{formatIDR(totalAssets)}</span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">2-101 Uang Muka Jamaah (Liabilitas)</span>
              <span className="tabular font-semibold text-slate-900">{formatIDR(getBal('2-101'))}</span>
            </div>
            <div className="px-5 py-3 flex justify-between">
              <span className="text-slate-700">2-102 Hutang Komisi Agen</span>
              <span className="tabular font-semibold text-slate-900">{formatIDR(getBal('2-102'))}</span>
            </div>
            <div className="px-5 py-3.5 flex justify-between bg-slate-50/80 font-bold text-slate-900 text-sm">
              <span>Total Liabilitas + Ekuitas</span>
              <span className="tabular">{formatIDR(totalLiabilities + totalEquity)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Jurnal Umum Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Buku Besar Jurnal Umum (Auto-Journal Engine)
            </h2>
            <p className="text-xs text-slate-500 tabular mt-0.5">
              Total Mutasi Debit: {formatIDR(ledgerTotals.debit)} · Total Mutasi Kredit: {formatIDR(ledgerTotals.credit)}
            </p>
          </div>
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/80 overflow-x-auto">
            {(
              [
                { id: 'ALL', label: 'Semua' },
                { id: 'PAYMENT', label: 'Pembayaran' },
                { id: 'DEPARTURE_RECOGNITION', label: 'Pengakuan Kloter' },
                { id: 'COMMISSION', label: 'Komisi' },
                { id: 'EXPENSE', label: 'Beban Vendor' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRefFilter(f.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors duration-150 ${refFilter === f.id
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                <th className="py-3 px-5">Tanggal &amp; No. Jurnal</th>
                <th className="py-3 px-4">Keterangan Transaksi</th>
                <th className="py-3 px-4">Akun (COA)</th>
                <th className="py-3 px-4 text-right">Debit</th>
                <th className="py-3 px-5 text-right">Kredit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredJournals.map((j) =>
                j.lines.map((line, idx) => (
                  <tr key={`${j.id}-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-5 font-mono-code text-slate-600 whitespace-nowrap">
                      {idx === 0 ? `${formatShortDate(j.date)} · ${j.entryNo}` : ''}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">
                      {idx === 0 ? (
                        <div>
                          <span className="font-medium">{j.description}</span>
                          {j.kloterCode && (
                            <span className="ml-2 font-mono-code text-[11px] text-slate-500">
                              [{j.kloterCode}]
                            </span>
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td
                      className={`py-2.5 px-4 font-mono-code text-slate-900 whitespace-nowrap ${line.credit > 0 ? 'pl-8 text-slate-600' : 'font-semibold'
                        }`}
                    >
                      {line.accountCode} {line.accountName}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular whitespace-nowrap">
                      {line.debit > 0 ? formatIDR(line.debit) : '-'}
                    </td>
                    <td className="py-2.5 px-5 text-right tabular whitespace-nowrap">
                      {line.credit > 0 ? formatIDR(line.credit) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Beban / Bayar Vendor */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 font-display">
                Catat Pengeluaran Vendor / Operasional
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Akun Beban / Aset Vendor
                </label>
                <select
                  value={expenseForm.expenseAccountCode}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, expenseAccountCode: e.target.value })
                  }
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  <option value="5-101">5-101 Beban Pokok Penjualan (Tiket, Hotel, Visa)</option>
                  <option value="1-105">1-105 Uang Muka Vendor (DP Maskapai / LA)</option>
                  <option value="5-301">5-301 Beban Operasional Kantor &amp; SDM</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Sumber Dana Pembayaran
                </label>
                <select
                  value={expenseForm.paymentAccountCode}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, paymentAccountCode: e.target.value })
                  }
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  <option value="1-102">1-102 Bank Operasional Syariah (BSI)</option>
                  <option value="1-101">1-101 Kas Tunai Kantor</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    min={100000}
                    step={500000}
                    required
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 tabular"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Alokasi Kloter (Opsional)
                  </label>
                  <select
                    value={expenseForm.kloterCode}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, kloterCode: e.target.value })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    <option value="">Umum (Non-Kloter)</option>
                    {departures.map((d) => (
                      <option key={d.id} value={d.kloterCode}>
                        {d.kloterCode}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Keterangan Transaksi
                </label>
                <input
                  type="text"
                  required
                  value={expenseForm.description}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, description: e.target.value })
                  }
                  placeholder="Contoh: Pelunasan Tiket Saudia Kloter 12A"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-white font-semibold rounded-lg"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  Posting Jurnal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
