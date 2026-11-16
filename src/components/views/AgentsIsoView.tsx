import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Agent,
  Departure,
  IncidentCategory,
  IsoIncident,
  Tenant,
} from '../../types/erp';
import { formatIDR, formatShortDate } from '../../utils/formatters';

interface AgentsIsoViewProps {
  tenant: Tenant;
  agents: Agent[];
  isoIncidents: IsoIncident[];
  departures: Departure[];
  onDisburseCommission: (agentId: string) => void;
  onCreateAgent: (input: {
    name: string;
    phone: string;
    parentAgentId?: string;
    directCommissionRate: number;
  }) => void;
  onUpdateIncidentStatus: (
    incidentId: string,
    status: IsoIncident['status'],
    resolutionNotes?: string
  ) => void;
  onCreateIncident: (input: {
    kloterCode: string;
    category: IncidentCategory;
    description: string;
    slaDeadline: string;
  }) => void;
}

export const AgentsIsoView: React.FC<AgentsIsoViewProps> = ({
  tenant,
  agents,
  isoIncidents,
  departures,
  onDisburseCommission,
  onCreateAgent,
  onUpdateIncidentStatus,
  onCreateIncident,
}) => {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showIncidentModal, setShowIncidentModal] = useState(false);

  const [agentForm, setAgentForm] = useState({
    name: '',
    phone: '',
    parentAgentId: '',
    directCommissionRate: 1500000,
  });

  const [incidentForm, setIncidentForm] = useState({
    kloterCode: departures[0]?.kloterCode || '',
    category: 'AKOMODASI' as IncidentCategory,
    description: '',
    slaDeadline: '2026-11-25',
  });

  const handleSubmitAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentForm.name.trim()) return;
    onCreateAgent({
      name: agentForm.name,
      phone: agentForm.phone,
      parentAgentId: agentForm.parentAgentId || undefined,
      directCommissionRate: agentForm.directCommissionRate,
    });
    setShowAgentModal(false);
    setAgentForm({ name: '', phone: '', parentAgentId: '', directCommissionRate: 1500000 });
  };

  const handleSubmitIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentForm.description.trim()) return;
    onCreateIncident(incidentForm);
    setShowIncidentModal(false);
    setIncidentForm((prev) => ({ ...prev, description: '' }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 font-display">
          Keagenan (Komisi Berjenjang) &amp; Tata Kelola ISO 9001:2015
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Perhitungan komisi direct dan overriding uplead agen, pencairan komisi terjurnal otomatis, serta log penanganan SLA komplain jamaah.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Agency & Commission Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Portal Agen &amp; Komisi Berjenjang
            </h2>
            <button
              type="button"
              onClick={() => setShowAgentModal(true)}
              className="h-8 px-3 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1 whitespace-nowrap shadow-2xs"
              style={{ backgroundColor: tenant.primaryColor }}
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Agen
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                  <th className="py-3 px-4">Kode &amp; Nama Agen</th>
                  <th className="py-3 px-3">Uplead / Sponsor</th>
                  <th className="py-3 px-3 text-right">Jamaah</th>
                  <th className="py-3 px-3 text-right">Belum Cair</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((a) => {
                  const unpaid = Math.max(0, a.commissionEarned - a.commissionPaid);
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{a.name}</div>
                        <div className="font-mono-code text-[11px] text-slate-500">
                          {a.code} · {formatIDR(a.directCommissionRate)}/pax
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-slate-600">
                        {a.parentAgentName || 'Agen Utama (Direct)'}
                      </td>
                      <td className="py-3.5 px-3 text-right tabular font-medium">{a.jamaahCount}</td>
                      <td className="py-3.5 px-3 text-right tabular font-semibold text-slate-900 whitespace-nowrap">
                        {formatIDR(unpaid)}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {unpaid > 0 ? (
                          <button
                            type="button"
                            onClick={() => onDisburseCommission(a.id)}
                            className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs"
                          >
                            Cairkan Komisi
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Lunas Cair</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ISO 9001:2015 SLA Incident Log */}
        <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              ISO 9001:2015 — SLA &amp; Incident Log
            </h2>
            <button
              type="button"
              onClick={() => setShowIncidentModal(true)}
              className="h-8 px-3 text-xs font-semibold border border-slate-200 bg-white text-slate-800 rounded-lg hover:bg-slate-50 inline-flex items-center gap-1 whitespace-nowrap shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Insiden
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                  <th className="py-3 px-4">Tiket &amp; Kategori</th>
                  <th className="py-3 px-3">Deskripsi &amp; Resolusi</th>
                  <th className="py-3 px-4 text-right">Status SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isoIncidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/70 align-top transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono-code font-semibold text-slate-900">{inc.ticket}</div>
                      <div className="text-[11px] text-slate-500">
                        {inc.category} · {inc.kloterCode}
                      </div>
                      <div className="text-[11px] text-slate-400 tabular">
                        SLA: {formatShortDate(inc.slaDeadline)}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-700 space-y-1.5">
                      <div>{inc.description}</div>
                      {inc.resolutionNotes && (
                        <div className="text-[11px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1.5 rounded-lg">
                          Resolusi: {inc.resolutionNotes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {inc.status !== 'RESOLVED' ? (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateIncidentStatus(
                              inc.id,
                              'RESOLVED',
                              'Ditindaklanjuti oleh tim Operasional sesuai prosedur SLA ISO 9001:2015.'
                            )
                          }
                          className="px-3 py-1.5 border border-red-200 bg-red-50 text-red-800 rounded-lg text-xs font-semibold hover:bg-red-100"
                        >
                          {inc.status === 'OPEN' ? 'OPEN · Selesaikan' : 'Proses · Selesaikan'}
                        </button>
                      ) : (
                        <span className="text-emerald-700 font-semibold">Resolved</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah Agen */}
      {showAgentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 font-display">
                Daftarkan Mitra Agen Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAgentModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitAgent} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nama Agen / KBIH</label>
                <input
                  type="text"
                  required
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                  placeholder="Contoh: Ust. Ridwan Kamil"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">No. Telepon / WA</label>
                <input
                  type="text"
                  required
                  value={agentForm.phone}
                  onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                  placeholder="0812-..."
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 tabular"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Komisi Direct / Pax (Rp)
                  </label>
                  <input
                    type="number"
                    min={250000}
                    step={250000}
                    value={agentForm.directCommissionRate}
                    onChange={(e) =>
                      setAgentForm({ ...agentForm, directCommissionRate: Number(e.target.value) })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-3 tabular"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Sponsor Uplead (Overriding)
                  </label>
                  <select
                    value={agentForm.parentAgentId}
                    onChange={(e) => setAgentForm({ ...agentForm, parentAgentId: e.target.value })}
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    <option value="">Tanpa Sponsor (Direct)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAgentModal(false)}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-white font-semibold rounded-lg"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  Simpan Agen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Catat Insiden ISO */}
      {showIncidentModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 font-display">
                Catat Tiket SLA ISO 9001:2015
              </h3>
              <button
                type="button"
                onClick={() => setShowIncidentModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
                aria-label="Tutup modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitIncident} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Kloter Terkait</label>
                  <select
                    value={incidentForm.kloterCode}
                    onChange={(e) =>
                      setIncidentForm({ ...incidentForm, kloterCode: e.target.value })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    {departures.map((d) => (
                      <option key={d.id} value={d.kloterCode}>
                        {d.kloterCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Kategori Layanan</label>
                  <select
                    value={incidentForm.category}
                    onChange={(e) =>
                      setIncidentForm({
                        ...incidentForm,
                        category: e.target.value as IncidentCategory,
                      })
                    }
                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                  >
                    <option value="AKOMODASI">Akomodasi Hotel</option>
                    <option value="KATERING">Katering</option>
                    <option value="TRANSPORTASI">Transportasi</option>
                    <option value="DOKUMEN">Dokumen &amp; Visa</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Batas Waktu SLA</label>
                <input
                  type="date"
                  required
                  value={incidentForm.slaDeadline}
                  onChange={(e) =>
                    setIncidentForm({ ...incidentForm, slaDeadline: e.target.value })
                  }
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 tabular"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Deskripsi Keluhan / Deviasi
                </label>
                <textarea
                  rows={3}
                  required
                  value={incidentForm.description}
                  onChange={(e) =>
                    setIncidentForm({ ...incidentForm, description: e.target.value })
                  }
                  placeholder="Jelaskan ketidaksesuaian layanan di lapangan..."
                  className="w-full border border-slate-200 rounded-lg p-3"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIncidentModal(false)}
                  className="h-9 px-4 border border-slate-200 rounded-lg text-slate-700 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 text-white font-semibold rounded-lg"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  Terbitkan Tiket SLA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
