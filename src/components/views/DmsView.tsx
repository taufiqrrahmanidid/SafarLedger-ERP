import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  FileCheck2,
  Loader2,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { DmsRecord, DocValidationStatus } from '../../types/erp';
import {
  formatShortDate,
  isPassportExpiringBeforeDeparture,
  monthsUntilExpiry,
} from '../../utils/formatters';

export type DmsDocType = 'KTP' | 'KK' | 'PASPOR' | 'MENINGITIS';

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
  onUploadFile?: (docId: string, docType: DmsDocType, file: File) => Promise<void> | void;
  onViewFile?: (docId: string, docType: DmsDocType) => Promise<void> | void;
}

const STATUS_META: Record<
  DocValidationStatus,
  { text: string; shortText: string; textCls: string; selectCls: string }
> = {
  VALID: {
    text: 'Valid',
    shortText: 'Valid',
    textCls: 'text-emerald-700 font-semibold',
    selectCls: 'border-emerald-200 bg-emerald-50/60 text-emerald-800 font-semibold',
  },
  REVIEW: {
    text: 'Menunggu Review',
    shortText: 'Review',
    textCls: 'text-amber-700 font-semibold',
    selectCls: 'border-amber-200 bg-amber-50/60 text-amber-800 font-semibold',
  },
  MISSING: {
    text: 'Belum Upload',
    shortText: 'Belum Upload',
    textCls: 'text-slate-600 font-medium',
    selectCls: 'border-slate-200 bg-slate-50 text-slate-700 font-medium',
  },
  REJECTED: {
    text: 'Ditolak',
    shortText: 'Ditolak',
    textCls: 'text-red-700 font-semibold',
    selectCls: 'border-red-200 bg-red-50/60 text-red-800 font-semibold',
  },
};

const STATUS_OPTIONS: { value: DocValidationStatus; label: string }[] = [
  { value: 'MISSING', label: 'Belum Upload' },
  { value: 'REVIEW', label: 'Menunggu Review' },
  { value: 'VALID', label: 'Valid' },
  { value: 'REJECTED', label: 'Ditolak' },
];

export const DmsView: React.FC<DmsViewProps> = ({
  dmsRecords,
  onUpdateDocument,
  onUploadFile,
  onViewFile,
}) => {
  const [filterMode, setFilterMode] = useState<'ALL' | 'ALERT_ONLY' | 'COMPLETE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [activeModalDocId, setActiveModalDocId] = useState<string | null>(null);

  const alertCount = useMemo(
    () =>
      dmsRecords.filter((d) =>
        isPassportExpiringBeforeDeparture(d.passportExpiry, d.departureDate)
      ).length,
    [dmsRecords]
  );

  const readyCount = useMemo(
    () =>
      dmsRecords.filter(
        (d) =>
          d.ktpStatus === 'VALID' &&
          d.kkStatus === 'VALID' &&
          d.passportStatus === 'VALID' &&
          d.meningitisStatus === 'VALID' &&
          !isPassportExpiringBeforeDeparture(d.passportExpiry, d.departureDate)
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

  const activeModalDoc = useMemo(
    () => dmsRecords.find((d) => d.id === activeModalDocId) || null,
    [dmsRecords, activeModalDocId]
  );

  const handleFilePick = async (docId: string, docType: DmsDocType, file?: File) => {
    if (!file || !onUploadFile) return;
    const key = `${docId}-${docType}`;
    setUploadingKey(key);
    try {
      await onUploadFile(docId, docType, file);
    } finally {
      setUploadingKey((prev) => (prev === key ? null : prev));
    }
  };

  const handleOpenFile = async (docId: string, docType: DmsDocType) => {
    if (!onViewFile) return;
    const key = `${docId}-${docType}`;
    setViewingKey(key);
    try {
      await onViewFile(docId, docType);
    } finally {
      setViewingKey((prev) => (prev === key ? null : prev));
    }
  };

  const renderFileButtons = (
    docId: string,
    docType: DmsDocType,
    jamaahName: string,
    hasFile?: boolean
  ) => {
    if (!onUploadFile && !onViewFile) return null;
    const key = `${docId}-${docType}`;
    const isUploading = uploadingKey === key;
    const isViewing = viewingKey === key;

    return (
      <div className="inline-flex items-center gap-1 shrink-0">
        {onUploadFile && (
          <label
            title={hasFile ? `Ganti file ${docType}` : `Upload file ${docType}`}
            className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${isUploading
                ? 'border-slate-200 bg-slate-100 text-slate-400 pointer-events-none'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
          >
            {isUploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3 text-slate-500" />
            )}
            <span>{isUploading ? 'Proses...' : hasFile ? 'Ganti' : 'Upload'}</span>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              aria-label={`Upload ${docType} untuk ${jamaahName}`}
              className="hidden"
              disabled={isUploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                void handleFilePick(docId, docType, f);
              }}
            />
          </label>
        )}
        {hasFile && onViewFile && (
          <button
            type="button"
            disabled={isViewing}
            onClick={() => void handleOpenFile(docId, docType)}
            title={`Lihat file ${docType}`}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0 transition-colors"
          >
            {isViewing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Eye className="w-3 h-3 text-slate-600" />
            )}
            <span>Lihat</span>
          </button>
        )}
      </div>
    );
  };

  const renderStatusSelect = (
    docId: string,
    label: string,
    jamaahName: string,
    value: DocValidationStatus,
    onChange: (next: DocValidationStatus) => void
  ) => (
    <select
      aria-label={`Status ${label} ${jamaahName}`}
      value={value}
      onChange={(e) => onChange(e.target.value as DocValidationStatus)}
      className={`h-7 px-2 rounded-md border text-[11px] focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-colors cursor-pointer ${STATUS_META[value].selectCls}`}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-white text-slate-900 font-normal">
          {opt.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            Document Management System (DMS) &amp; Kepatuhan Paspor
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Verifikasi berkas visa umrah/haji (KTP, KK, Paspor, Vaksin Meningitis) dan deteksi otomatis masa berlaku paspor &lt; 6 bulan sebelum terbang.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs tabular-nums whitespace-nowrap">
          <span className="text-slate-500">Total Berkas:</span>
          <strong className="text-slate-900">{dmsRecords.length}</strong>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-emerald-700 font-semibold">{readyCount} Siap Visa</span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-red-700 font-semibold">{alertCount} Paspor Perlu Perpanjangan</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/80 self-start">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Semua Jamaah ({dmsRecords.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ALERT_ONLY')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${filterMode === 'ALERT_ONLY' ? 'bg-white text-red-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Paspor &lt; 6 Bln / Kosong ({alertCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('COMPLETE')}
              className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${filterMode === 'COMPLETE' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Siap Visa ({readyCount})
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
                <th className="py-3 px-5">Jamaah &amp; Kloter</th>
                <th className="py-3 px-3">Identitas (KTP &amp; KK)</th>
                <th className="py-3 px-3">Paspor &amp; Masa Berlaku</th>
                <th className="py-3 px-3">Vaksin Meningitis</th>
                <th className="py-3 px-5 text-right">Aksi Admin &amp; Visa</th>
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
                  const validCount = [
                    doc.ktpStatus,
                    doc.kkStatus,
                    doc.passportStatus,
                    doc.meningitisStatus,
                  ].filter((s) => s === 'VALID').length;
                  const readyForVisa = validCount === 4 && !expiringSoon;

                  return (
                    <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors align-top">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900">{doc.jamaahName}</div>
                        <div className="text-[11px] text-slate-500 font-mono-code mt-0.5 tabular-nums">
                          {doc.kloterCode} · {formatShortDate(doc.departureDate)}
                        </div>
                        <div className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
                          Kelengkapan: <strong className="text-slate-800">{validCount}/4</strong> berkas valid
                        </div>
                      </td>

                      <td className="py-3.5 px-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-7 shrink-0 font-medium">KTP</span>
                          {renderStatusSelect(doc.id, 'KTP', doc.jamaahName, doc.ktpStatus, (next) =>
                            onUpdateDocument(doc.id, { ktpStatus: next })
                          )}
                          {renderFileButtons(doc.id, 'KTP', doc.jamaahName, doc.hasKtpFile)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 w-7 shrink-0 font-medium">KK</span>
                          {renderStatusSelect(doc.id, 'KK', doc.jamaahName, doc.kkStatus, (next) =>
                            onUpdateDocument(doc.id, { kkStatus: next })
                          )}
                          {renderFileButtons(doc.id, 'KK', doc.jamaahName, doc.hasKkFile)}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="text"
                            aria-label={`Nomor paspor ${doc.jamaahName}`}
                            placeholder="No. Paspor"
                            value={doc.passportNo === '-' ? '' : doc.passportNo}
                            onChange={(e) =>
                              onUpdateDocument(doc.id, {
                                passportNo: e.target.value.toUpperCase() || '-',
                              })
                            }
                            className="w-28 h-7 px-2 border border-slate-200 rounded-md font-mono-code text-xs bg-white focus:outline-none focus:border-slate-400"
                          />
                          <input
                            type="date"
                            aria-label={`Expired paspor ${doc.jamaahName}`}
                            value={doc.passportExpiry}
                            onChange={(e) =>
                              onUpdateDocument(doc.id, { passportExpiry: e.target.value })
                            }
                            className="h-7 px-2 border border-slate-200 rounded-md text-xs tabular-nums bg-white focus:outline-none focus:border-slate-400"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStatusSelect(
                            doc.id,
                            'Paspor',
                            doc.jamaahName,
                            doc.passportStatus,
                            (next) => onUpdateDocument(doc.id, { passportStatus: next })
                          )}
                          {renderFileButtons(doc.id, 'PASPOR', doc.jamaahName, doc.hasPassportFile)}
                        </div>
                        <div className="text-[11px] tabular-nums flex items-center gap-1.5">
                          {expiringSoon ? (
                            <span className="text-red-700 font-semibold inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
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
                        <div className="flex items-center gap-2">
                          {renderStatusSelect(
                            doc.id,
                            'Vaksin Meningitis',
                            doc.jamaahName,
                            doc.meningitisStatus,
                            (next) => onUpdateDocument(doc.id, { meningitisStatus: next })
                          )}
                          {renderFileButtons(
                            doc.id,
                            'MENINGITIS',
                            doc.jamaahName,
                            doc.hasMeningitisFile
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-2">
                          {readyForVisa ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Siap Proses Visa</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700 font-medium">
                              {expiringSoon && validCount === 4
                                ? 'Cek Masa Berlaku Paspor'
                                : 'Menunggu Verifikasi'}
                            </span>
                          )}

                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setActiveModalDocId(doc.id)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 whitespace-nowrap shrink-0 transition-colors"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                              <span>{readyForVisa ? 'Kelola' : 'Verifikasi'}</span>
                            </button>

                            {!readyForVisa && validCount < 4 && (
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
                                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Setujui Semua</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Audit & Verifikasi Berkas Jamaah */}
      {activeModalDoc && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dms-audit-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div>
                <h2 id="dms-audit-modal-title" className="text-base font-bold text-slate-900 font-display">
                  Audit &amp; Verifikasi Berkas — {activeModalDoc.jamaahName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {activeModalDoc.kloterCode} · Keberangkatan {formatShortDate(activeModalDoc.departureDate)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup panel verifikasi"
                onClick={() => setActiveModalDocId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900">
                    Data Paspor &amp; Kepatuhan Imigrasi (Minimal 6 Bulan)
                  </span>
                  {isPassportExpiringBeforeDeparture(
                    activeModalDoc.passportExpiry,
                    activeModalDoc.departureDate
                  ) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {activeModalDoc.passportExpiry
                        ? `Sisa ${Math.max(
                          0,
                          monthsUntilExpiry(activeModalDoc.passportExpiry, activeModalDoc.departureDate)
                        )} bln saat terbang`
                        : 'Belum diisi'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Aman ({monthsUntilExpiry(activeModalDoc.passportExpiry, activeModalDoc.departureDate)} bln)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nomor Paspor
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: C1234567"
                      value={activeModalDoc.passportNo === '-' ? '' : activeModalDoc.passportNo}
                      onChange={(e) =>
                        onUpdateDocument(activeModalDoc.id, {
                          passportNo: e.target.value.toUpperCase() || '-',
                        })
                      }
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg font-mono-code text-xs bg-white focus:outline-none focus:border-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Tanggal Berakhir (Expired Date)
                    </label>
                    <input
                      type="date"
                      value={activeModalDoc.passportExpiry}
                      onChange={(e) =>
                        onUpdateDocument(activeModalDoc.id, { passportExpiry: e.target.value })
                      }
                      className="w-full h-9 px-3 border border-slate-200 rounded-lg text-xs tabular-nums bg-white focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: 'KTP' as DmsDocType,
                      title: 'Kartu Tanda Penduduk (KTP)',
                      status: activeModalDoc.ktpStatus,
                      hasFile: activeModalDoc.hasKtpFile,
                      field: 'ktpStatus' as const,
                    },
                    {
                      key: 'KK' as DmsDocType,
                      title: 'Kartu Keluarga (KK)',
                      status: activeModalDoc.kkStatus,
                      hasFile: activeModalDoc.hasKkFile,
                      field: 'kkStatus' as const,
                    },
                    {
                      key: 'PASPOR' as DmsDocType,
                      title: 'Scan Halaman Utama Paspor',
                      status: activeModalDoc.passportStatus,
                      hasFile: activeModalDoc.hasPassportFile,
                      field: 'passportStatus' as const,
                    },
                    {
                      key: 'MENINGITIS' as DmsDocType,
                      title: 'Kartu Vaksin Meningitis (ICV)',
                      status: activeModalDoc.meningitisStatus,
                      hasFile: activeModalDoc.hasMeningitisFile,
                      field: 'meningitisStatus' as const,
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.key}
                    className="p-4 rounded-lg border border-slate-200 bg-white flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">{item.title}</div>
                        <div className={`text-[11px] mt-0.5 ${STATUS_META[item.status].textCls}`}>
                          Status: {STATUS_META[item.status].text}
                        </div>
                      </div>
                      {renderFileButtons(
                        activeModalDoc.id,
                        item.key,
                        activeModalDoc.jamaahName,
                        item.hasFile
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onUpdateDocument(activeModalDoc.id, { [item.field]: 'VALID' })}
                        className={`flex-1 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${item.status === 'VALID'
                            ? 'bg-emerald-600 text-white'
                            : 'border border-slate-200 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                          }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>Valid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateDocument(activeModalDoc.id, { [item.field]: 'REVIEW' })}
                        className={`flex-1 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${item.status === 'REVIEW'
                            ? 'bg-amber-500 text-white'
                            : 'border border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                          }`}
                      >
                        <FileCheck2 className="w-3 h-3" />
                        <span>Review</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateDocument(activeModalDoc.id, { [item.field]: 'REJECTED' })
                        }
                        className={`flex-1 inline-flex items-center justify-center gap-1 h-7 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap transition-colors ${item.status === 'REJECTED'
                            ? 'bg-red-600 text-white'
                            : 'border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                          }`}
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Tolak</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  onUpdateDocument(activeModalDoc.id, {
                    ktpStatus: 'MISSING',
                    kkStatus: 'MISSING',
                    passportStatus: 'MISSING',
                    meningitisStatus: 'MISSING',
                  })
                }
                className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:text-red-700 hover:border-red-200 whitespace-nowrap shrink-0 transition-colors"
              >
                Reset Status Berkas
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModalDocId(null)}
                  className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 transition-colors"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateDocument(activeModalDoc.id, {
                      ktpStatus: 'VALID',
                      kkStatus: 'VALID',
                      passportStatus: 'VALID',
                      meningitisStatus: 'VALID',
                    });
                    setActiveModalDocId(null);
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Setujui Semua &amp; Tutup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};