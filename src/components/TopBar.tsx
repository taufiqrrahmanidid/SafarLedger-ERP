import React from 'react';
import { Plus } from 'lucide-react';
import { ErpTab, Tenant, UserRole } from '../types/erp';
import { HijriDateLine, RubElHizbMark } from './IslamicOrnament';

interface TopBarProps {
  tenants: Tenant[];
  selectedTenantId: string;
  onChangeTenant?: (tenantId: string) => void;
  activeRole: UserRole;
  allowedTabs: ErpTab[];
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
  users: 'Kelola Akun Staf',
  superadmin: 'Super-Admin Tenant & Akun',
};

const ROLE_DISPLAY: Record<UserRole, string> = {
  OWNER: 'Owner / Direksi',
  OPS: 'Admin Operasional',
  FINANCE: 'Kasir / Akuntansi',
  AGENT: 'Portal Agen',
  SUPER_ADMIN: 'Super-Admin (Developer)',
};

export const TopBar: React.FC<TopBarProps> = ({
  tenants,
  selectedTenantId,
  onChangeTenant,
  activeRole,
  allowedTabs,
  currentTab,
  onSelectTab,
  onOpenQuickRegister,
}) => {
  const activeTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];
  const canQuickRegister =
    activeRole === 'SUPER_ADMIN' ||
    activeRole === 'OWNER' ||
    activeRole === 'OPS' ||
    activeRole === 'AGENT';

  return (
    <header className="no-print bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 lg:px-7 h-16 flex items-center justify-between gap-6 sticky top-0 z-30">
      {/* Zone 1: Brand & Contextual Breadcrumb */}
      <div className="flex items-center gap-2.5 text-xs min-w-0">
        <span className="inline-flex items-center gap-2 font-display font-bold text-sm tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          <RubElHizbMark className="w-4 h-4 text-emerald-800" />
          <span>SafarLedger</span>
        </span>
        {activeTenant && (
          <>
            <span className="text-slate-300 shrink-0">/</span>
            <span className="text-slate-500 truncate hidden sm:inline max-w-[200px]">
              {activeTenant.name}
            </span>
          </>
        )}
        <span className="text-slate-300 shrink-0 hidden sm:inline">/</span>
        <span className="text-slate-900 font-semibold truncate">
          {TAB_LABELS[currentTab]}
        </span>
        <span className="text-slate-300 shrink-0 hidden xl:inline">·</span>
        <HijriDateLine className="hidden xl:inline text-[11px] font-medium text-amber-800/90 whitespace-nowrap" />
      </div>

      {/* Zone 2 & 3: Status Akses, Switcher Khusus Super-Admin & Primary Action */}
      <div className="flex items-center gap-3 shrink-0">
        {activeRole === 'SUPER_ADMIN' && tenants.length > 1 && onChangeTenant && (
          <div className="hidden md:flex items-center gap-2">
            <label htmlFor="tenant-select" className="text-xs text-slate-500 whitespace-nowrap">
              Workspace
            </label>
            <select
              id="tenant-select"
              value={selectedTenantId}
              onChange={(e) => onChangeTenant(e.target.value)}
              className="h-9 border border-slate-200 rounded-lg px-2.5 bg-slate-50/70 text-slate-800 text-xs font-medium focus:outline-none focus:border-slate-400"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.plan})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-lg bg-slate-50 border border-slate-200/80 text-xs">
          <span className="text-slate-400">Akses:</span>
          <span className="font-semibold text-slate-800">{ROLE_DISPLAY[activeRole]}</span>
        </div>

        {/* Mobile Tab Selector (hanya tab yang diizinkan oleh role) */}
        <select
          aria-label="Pilih Modul"
          value={currentTab}
          onChange={(e) => onSelectTab(e.target.value as ErpTab)}
          className="lg:hidden h-9 border border-slate-200 rounded-lg px-2 bg-white text-slate-900 text-xs max-w-[140px]"
        >
          {allowedTabs.map((tabKey) => (
            <option key={tabKey} value={tabKey}>
              {TAB_LABELS[tabKey]}
            </option>
          ))}
        </select>

        {canQuickRegister && activeTenant && (
          <button
            type="button"
            onClick={onOpenQuickRegister}
            className="h-9 px-4 text-xs font-semibold text-white rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition-all duration-150 hover:opacity-95 active:scale-[0.99]"
            style={{ backgroundColor: activeTenant.primaryColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Daftarkan Jamaah</span>
          </button>
        )}
      </div>
    </header>
  );
};