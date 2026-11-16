import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { DmsRecord, DocValidationStatus } from '../../types/erp';
import {
  formatShortDate,
  isPassportExpiringBeforeDeparture,
  monthsUntilExpiry,
} from '../../utils/formatters';

interface DmsViewProps {
  dmsRecords: DmsRecord[];
  onUpdateDocument: (
    docId: string,
    patch: Partial<
      Pick<
        DmsRecord,
        | 'ktpStatus'
        | 'kkStatus'
        | 'passportNo'
        | 'passportExpiry'
        | 'passportStatus'
        | 'meningitisStatus'
        | 'mahramDocStatus'
      >
    >
  ) => void;
}

const STATUS_LABEL: Record<DocValidationStatus, { text: string; cls: string }> = {
  VALID: { text: 'Valid', cls: 'text-emerald-700 font-semibold' },
  REVIEW: { text: 'Menunggu Review', cls: 'text-amber-700 font-semibold' },
  MISSING: { text: 'Belum Upload', cls: 'text-red-700 font-semibold' },
  REJECTED: { text: 'Ditolak', cls: 'text-red-700 font-semibold' },
};

export const DmsView: React.FC<DmsViewProps> = ({ dmsRecords, onUpdateDocument }) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'ALERT_ONLY' | 'COMPLETE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const alertCount = useMemo(
    () =>
      dmsRecords.filter((d) =>
        isPassportExpiringBeforeDeparture(d.passportExpiry, d.departureDate)
      ).length,
    [dmsRecords]
  );

  const filteredRecords = useMemo(() => {
    return dmsRecords.filter((d) => {
      const expiring = isPassportExpiringBeforeDeparture(d.passportExpiry, d.departureDate);
      const allValid =
        d.ktpStatus === 'VALID' &&
        d.kkStatus === 'VALID' &&
        d.passportStatus === 'VALID' &&
        d.meningitisStatus === 'VALID' &&
        !expiring;

      if (filterMode === 'ALERT_ONLY' && !expiring) return false;
      if (filterMode === 'COMPLETE' && !allValid) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        d.jamaahName.toLowerCase().includes(q) ||
        d.passportNo.toLowerCase().includes(q) ||
        d.kloterCode.toLowerCase().includes(q)
      );
    });
  }, [dmsRecords, filterMode, searchQuery]);

  const cycleStatus = (curr: DocValidationStatus): DocValidationStatus => {
    if (curr === 'MISSING') return 'REVIEW';
    if (curr === 'REVIEW') return 'VALID';
    if (curr === 'VALID') return 'REJECTED';
    return 'VALID';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            Document Management System (DMS) &amp; Kepatuhan Paspor
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Validasi berkas visa umrah/haji (KTP, KK, Paspor, Vaksin Meningitis) dan deteksi otomatis masa berlaku paspor &lt; 6 bulan sebelum terbang.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs tabular">
          <span className="text-slate-500">Total Berkas:</span>
          <strong className="text-slate-900">{dmsRecords.length}</strong>
          <span className="text-slate-300">·</span>
          <span className="text-red-700 font-semibold">{alertCount} Paspor Perlu Perpanjangan</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/80 self-start">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Semua Jamaah ({dmsRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ALERT_ONLY')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                filterMode === 'ALERT_ONLY' ? 'bg-white text-red-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Paspor &lt; 6 Bln / Kosong ({alertCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('COMPLETE')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap ${
                filterMode === 'COMPLETE' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Siap Visa
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari jamaah / no. paspor..."
              className="h-8 pl-8 pr-3 border border-slate-200 rounded-lg text-xs w-56 bg-slate-50/70 focus:bg-white focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                <th className="py-3 px-5">Nama Jamaah &amp; Kloter</th>
                <th className="py-3 px-3">KTP &amp; KK (Klik Ubah)</th>
                <th className="py-3 px-3">No. Paspor &amp; Masa Berlaku</th>
                <th className="py-3 px-3">Vaksin Meningitis</th>
                <th className="py-3 px-5 text-right">Status Kesiapan Visa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    Tidak ada berkas jamaah pada kategori filter ini.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((doc) => {
                  const expiringSoon = isPassportExpiringBeforeDeparture(
                    doc.passportExpiry,
                    doc.departureDate
                  );
                  const remMonths = monthsUntilExpiry(doc.passportExpiry, doc.departureDate);
                  const readyForVisa =
                    doc.ktpStatus === 'VALID' &&
                    doc.kkStatus === 'VALID' &&
                    doc.passportStatus === 'VALID' &&
                    doc.meningitisStatus === 'VALID' &&
                    !expiringSoon;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900">{doc.jamaahName}</div>
                        <div className="text-[11px] text-slate-500 font-mono-code">
                          {doc.kloterCode} · Berangkat {formatShortDate(doc.departureDate)}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-7">KTP:</span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDocument(doc.id, { ktpStatus: cycleStatus(doc.ktpStatus) })
                            }
                            className={`underline-offset-2 hover:underline ${STATUS_LABEL[doc.ktpStatus].cls}`}
                          >
                            {STATUS_LABEL[doc.ktpStatus].text}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-7">KK:</span>
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDocument(doc.id, { kkStatus: cycleStatus(doc.kkStatus) })
                            }
                            className={`underline-offset-2 hover:underline ${STATUS_LABEL[doc.kkStatus].cls}`}
                          >
                            {STATUS_LABEL[doc.kkStatus].text}
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            aria-label={`Nomor paspor ${doc.jamaahName}`}
                            value={doc.passportNo}
                            onChange={(e) =>
                              onUpdateDocument(doc.id, {
                                passportNo: e.target.value.toUpperCase(),
                              })
                            }
                            className="w-24 h-7 px-2 border border-slate-200 rounded-md font-mono-code text-xs bg-white"
                          />
                          <input
                            type="date"
                            aria-label={`Expired paspor ${doc.jamaahName}`}
                            value={doc.passportExpiry}
                            onChange={(e) =>
                              onUpdateDocument(doc.id, { passportExpiry: e.target.value })
                            }
                            className="h-7 px-2 border border-slate-200 rounded-md text-xs tabular bg-white"
                          />
                        </div>
                        <div className="text-[11px] tabular flex items-center gap-1.5">
                          {expiringSoon ? (
                            <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {doc.passportExpiry
                                ? `Sisa ${Math.max(0, remMonths)} bln saat berangkat (< 6 Bln)`
                                : 'Paspor belum diinput'}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">
                              Masa berlaku aman ({remMonths} bln saat berangkat)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateDocument(doc.id, {
                              meningitisStatus: cycleStatus(doc.meningitisStatus),
                            })
                          }
                          className={`underline-offset-2 hover:underline ${
                            STATUS_LABEL[doc.meningitisStatus].cls
                          }`}
                        >
                          {STATUS_LABEL[doc.meningitisStatus].text}
                        </button>
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {readyForVisa ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Siap Proses Visa
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDocument(doc.id, {
                                ktpStatus: 'VALID',
                                kkStatus: 'VALID',
                                passportStatus: 'VALID',
                                meningitisStatus: 'VALID',
                              })
                            }
                            className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs"
                          >
                            Validasi Semua Berkas
                          </button>
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
    </div>
  );
};
