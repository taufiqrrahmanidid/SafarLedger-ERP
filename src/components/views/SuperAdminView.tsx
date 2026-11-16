import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { PlanTier, Tenant } from '../../types/erp';

interface SuperAdminViewProps {
  tenants: Tenant[];
  activeTenantId: string;
  onSelectTenant: (tenantId: string) => void;
  onCreateTenant: (input: {
    name: string;
    subdomain: string;
    ppiu: string;
    pihk: string;
    plan: PlanTier;
    primaryColor: string;
  }) => void;
  onUpdateTenantTheme: (tenantId: string, primaryColor: string) => void;
}

const PRESET_COLORS = [
  { label: 'Emerald Haramain', hex: '#0F4C3A' },
  { label: 'Deep Navy', hex: '#1E3A5F' },
  { label: 'Slate Charcoal', hex: '#1E293B' },
  { label: 'Bronze Umrah', hex: '#78350F' },
];

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  tenants,
  activeTenantId,
  onSelectTenant,
  onCreateTenant,
  onUpdateTenantTheme,
}) => {
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    ppiu: '',
    pihk: 'Belum Terdaftar',
    plan: 'PRO' as PlanTier,
    primaryColor: '#0F4C3A',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subdomain.trim()) return;
    onCreateTenant(form);
    setForm({
      name: '',
      subdomain: '',
      ppiu: '',
      pihk: 'Belum Terdaftar',
      plan: 'PRO',
      primaryColor: '#0F4C3A',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 font-display">
          Super-Admin CMS: Provisioning Tenant SaaS &amp; White-Labeling
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Kelola biro travel multi-tenant, isolasi database per tenant, injeksi Master COA SAK ETAP otomatis, dan kustomisasi warna merek.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
          <h2 className="text-sm font-semibold text-slate-900 font-display border-b border-slate-100 pb-3">
            Provisioning Biro Travel Baru
          </h2>
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Nama Resmi Biro (PT)</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="PT Safar Berkah Madinah"
                className="w-full h-9 border border-slate-200 rounded-lg px-3"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-medium mb-1">Subdomain SaaS</label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-9">
                <input
                  type="text"
                  required
                  value={form.subdomain}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                  placeholder="safarberkah"
                  className="flex-1 h-full px-3 font-mono-code focus:outline-none"
                />
                <span className="px-2.5 bg-slate-100 text-slate-500 text-[11px] border-l border-slate-200 h-full flex items-center">
                  .safarledger.id
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 font-medium mb-1">No. Izin PPIU</label>
                <input
                  type="text"
                  required
                  value={form.ppiu}
                  onChange={(e) => setForm({ ...form, ppiu: e.target.value })}
                  placeholder="U.512/2026"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 font-mono-code"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">No. Izin PIHK</label>
                <input
                  type="text"
                  value={form.pihk}
                  onChange={(e) => setForm({ ...form, pihk: e.target.value })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-3 font-mono-code"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Paket Langganan</label>
                <select
                  value={form.plan}
                  onChange={(e) => setForm({ ...form, plan: e.target.value as PlanTier })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  <option value="LITE">Lite (100 Jamaah/Bln)</option>
                  <option value="PRO">Pro (350 Jamaah/Bln)</option>
                  <option value="ENTERPRISE">Enterprise (1000/Bln)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Warna Brand Primer</label>
                <div className="flex items-center gap-2 h-9">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.label}
                      onClick={() => setForm({ ...form, primaryColor: c.hex })}
                      className={`w-6 h-6 rounded-md border ${
                        form.primaryColor === c.hex
                          ? 'ring-2 ring-slate-900 ring-offset-1'
                          : 'border-slate-300'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <button
              type="submit"
              className="w-full h-10 text-xs font-semibold text-white rounded-lg inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Provision Tenant &amp; Injeksi COA Standar
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 font-display">
              Daftar Biro Travel Terdaftar ({tenants.length} Tenant)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                  <th className="py-3 px-5">Biro Travel</th>
                  <th className="py-3 px-4">Domain &amp; Izin Kemenag</th>
                  <th className="py-3 px-4">Lisensi</th>
                  <th className="py-3 px-4">Warna White-Label</th>
                  <th className="py-3 px-5 text-right">Konteks Workspace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => {
                  const isCurrent = t.id === activeTenantId;
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-semibold text-slate-900">{t.name}</div>
                        <div className="text-[11px] text-slate-500 tabular">
                          Maks {t.maxJamaahPerMonth} jamaah/bln · {t.maxUsers} user
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono-code text-slate-800">
                          {t.customDomain || `${t.subdomain}.safarledger.id`}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular">
                          PPIU {t.ppiu} · PIHK {t.pihk}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {t.plan}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              title={`Ubah tema ke ${c.label}`}
                              onClick={() => onUpdateTenantTheme(t.id, c.hex)}
                              className={`w-5 h-5 rounded-md border ${
                                t.primaryColor === c.hex
                                  ? 'ring-2 ring-slate-900 ring-offset-1'
                                  : 'border-slate-300'
                              }`}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {isCurrent ? (
                          <span className="text-emerald-700 font-semibold">Tenant Aktif</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectTenant(t.id)}
                            className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-800 hover:bg-slate-50 shadow-2xs"
                          >
                            Masuk Workspace
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
