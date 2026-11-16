import React from 'react';
import { Plus } from 'lucide-react';
import { ErpTab, Tenant, UserRole } from '../types/erp';

interface TopBarProps {
  tenants: Tenant[];
  selectedTenantId: string;
  onChangeTenant: (tenantId: string) => void;
  activeRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  currentTab: ErpTab;
  onSelectTab: (tab: ErpTab) => void;
  onOpenQuickRegister: () => void;
}

const TAB_LABELS: Record<ErpTab, string> = {
  dashboard: 'Ringkasan Eksekutif',
  bookings: 'Paket, Manifes & Rooming List',
  dms: 'Dokumen & Paspor (DMS)',
  payments: 'Pembayaran & Kuitansi QR',
  accounting: 'Akuntansi SAK ETAP',
  inventory: 'Gudang & Perlengkapan',
  agents: 'Keagenan & ISO 9001 SLA',
  superadmin: 'Super-Admin Tenant CMS',
};

const ROLE_LABELS: { value: UserRole; label: string }[] = [
  { value: 'OWNER', label: 'Owner / Direksi' },
  { value: 'OPS', label: 'Admin Operasional' },
  { value: 'FINANCE', label: 'Kasir / Akuntansi' },
  { value: 'AGENT', label: 'Portal Agen' },
  { value: 'SUPER_ADMIN', label: 'Super-Admin SaaS' },
];

export const TopBar: React.FC<TopBarProps> = ({
  tenants,
  selectedTenantId,
  onChangeTenant,
  activeRole,
  onChangeRole,
  currentTab,
  onSelectTab,
  onOpenQuickRegister,
}) => {
  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];

  return (
    <header className="no-print bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 lg:px-7 h-16 flex items-center justify-between gap-6 sticky top-0 z-30">
      {/* Zone 1: Brand & Contextual Breadcrumb */}
      <div className="flex items-center gap-2.5 text-xs min-w-0">
        <span className="font-display font-bold text-sm tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          SafarLedger
        </span>
        <span className="text-slate-300 shrink-0">/</span>
        <span className="text-slate-500 truncate hidden sm:inline max-w-[210px]">
          {activeTenant.name}
        </span>
        <span className="text-slate-300 shrink-0 hidden sm:inline">/</span>
        <span className="text-slate-900 font-semibold truncate">
          {TAB_LABELS[currentTab]}
        </span>
      </div>

      {/* Zone 2 & 3: Workspace Switchers & Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden md:flex items-center gap-2">
          <label htmlFor="tenant-select" className="text-xs text-slate-500 whitespace-nowrap">
            Tenant
          </label>
          <select
            id="tenant-select"
            value={selectedTenantId}
            onChange={(e) => onChangeTenant(e.target.value)}
            className="h-9 border border-slate-200 rounded-lg px-2.5 bg-slate-50/70 text-slate-800 text-xs font-medium focus:outline-none focus:border-slate-400 transition-colors"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.plan})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="role-select" className="text-xs text-slate-500 whitespace-nowrap hidden sm:inline">
            Peran
          </label>
          <select
            id="role-select"
            value={activeRole}
            onChange={(e) => onChangeRole(e.target.value as UserRole)}
            className="h-9 border border-slate-200 rounded-lg px-2.5 bg-slate-50/70 text-slate-900 font-medium text-xs focus:outline-none focus:border-slate-400 transition-colors"
          >
            {ROLE_LABELS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Mobile Tab Selector */}
        <select
          aria-label="Pilih Modul"
          value={currentTab}
          onChange={(e) => onSelectTab(e.target.value as ErpTab)}
          className="lg:hidden h-9 border border-slate-200 rounded-lg px-2 bg-white text-slate-900 text-xs max-w-[135px]"
        >
          {(Object.keys(TAB_LABELS) as ErpTab[]).map((tabKey) => (
            <option key={tabKey} value={tabKey}>
              {TAB_LABELS[tabKey]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onOpenQuickRegister}
          className="h-9 px-4 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition-all duration-150 hover:opacity-95 active:scale-[0.99]"
          style={{ backgroundColor: activeTenant.primaryColor }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Daftarkan Jamaah</span>
        </button>
      </div>
    </header>
  );
};
