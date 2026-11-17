import React from 'react';
import {
  LayoutDashboard,
  Users,
  FileCheck2,
  Receipt,
  BookOpen,
  PackageCheck,
  Award,
  Building2,
  UserCog,
  LogOut,
} from 'lucide-react';
import { ErpTab, Tenant, UserRole } from '../types/erp';
import { RubElHizbMark } from './IslamicOrnament';

interface SidebarProps {
  activeTenant: Tenant;
  activeRole: UserRole;
  currentTab: ErpTab;
  onSelectTab: (tab: ErpTab) => void;
  expiredPassportCount: number;
  openIsoCount: number;
  lowStockCount: number;
  onResetDemoData: () => void;
}

interface NavItem {
  id: ErpTab;
  label: string;
  icon: React.FC<{ className?: string }>;
  alertCount?: number;
  alertLabel?: string;
  roles: UserRole[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTenant,
  activeRole,
  currentTab,
  onSelectTab,
  expiredPassportCount,
  openIsoCount,
  lowStockCount,
  onResetDemoData,
}) => {
  const operationalItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Ringkasan Eksekutif',
      icon: LayoutDashboard,
      roles: ['OWNER', 'SUPER_ADMIN'],
    },
    {
      id: 'bookings',
      label: 'Paket & Rooming List',
      icon: Users,
      roles: ['OWNER', 'OPS', 'AGENT', 'SUPER_ADMIN'],
    },
    {
      id: 'dms',
      label: 'Dokumen & Paspor',
      icon: FileCheck2,
      alertCount: expiredPassportCount,
      alertLabel: 'Paspor < 6 Bln',
      roles: ['OWNER', 'OPS', 'SUPER_ADMIN'],
    },
  ];

  const financeItems: NavItem[] = [
    {
      id: 'payments',
      label: 'Kasir & Kuitansi QR',
      icon: Receipt,
      roles: ['OWNER', 'FINANCE', 'OPS', 'SUPER_ADMIN'],
    },
    {
      id: 'accounting',
      label: 'Akuntansi SAK ETAP',
      icon: BookOpen,
      roles: ['OWNER', 'FINANCE', 'SUPER_ADMIN'],
    },
  ];

  const governanceItems: NavItem[] = [
    {
      id: 'inventory',
      label: 'Gudang & Perlengkapan',
      icon: PackageCheck,
      alertCount: lowStockCount,
      alertLabel: 'Stok Minimum',
      roles: ['OWNER', 'OPS', 'SUPER_ADMIN'],
    },
    {
      id: 'agents',
      label: 'Keagenan & ISO SLA',
      icon: Award,
      alertCount: openIsoCount,
      alertLabel: 'SLA Terbuka',
      roles: ['OWNER', 'OPS', 'FINANCE', 'AGENT', 'SUPER_ADMIN'],
    },
    {
      id: 'users',
      label: 'Kelola Akun Staf',
      icon: UserCog,
      roles: ['OWNER'],
    },
    {
      id: 'superadmin',
      label: 'Super-Admin & Akun',
      icon: Building2,
      roles: ['SUPER_ADMIN'],
    },
  ];

  const renderGroup = (title: string, items: NavItem[]) => {
    const visibleItems = items.filter((item) => item.roles.includes(activeRole));
    if (visibleItems.length === 0) return null;

    return (
      <div>
        <div className="px-3 mb-2 text-[11px] font-medium tracking-wide text-slate-400/80">
          {title}
        </div>
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13px] transition-all duration-150 whitespace-nowrap border ${isActive
                    ? 'bg-white/12 border-amber-300/25 text-white font-semibold shadow-sm'
                    : 'border-transparent text-emerald-50/75 hover:bg-white/6 hover:text-white font-medium'
                    }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors duration-150 ${isActive ? 'text-white' : 'text-slate-400'
                        }`}
                      style={isActive ? { backgroundColor: activeTenant.primaryColor } : undefined}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.alertCount !== undefined && item.alertCount > 0 && (
                    <span
                      title={item.alertLabel}
                      className="text-[11px] font-mono-code font-semibold text-amber-300 tabular shrink-0 ml-2"
                    >
                      {item.alertCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <aside className="no-print w-64 bg-[#071D17] haramain-sidebar-bg text-slate-200 shrink-0 hidden lg:flex flex-col justify-between py-5 border-r border-emerald-950">
      <div className="space-y-6 px-3.5">
        {/* Tenant White-Label Brand Lockup */}
        <div className="px-2 pb-4 border-b border-amber-300/15">
          <div className="flex items-center gap-3">
            <div
              className="relative w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold text-sm shrink-0 shadow-sm ring-1 ring-amber-300/35 overflow-hidden"
              style={{ backgroundColor: activeTenant.primaryColor }}
            >
              <RubElHizbMark className="w-8 h-8 text-amber-200/20 absolute" />
              <span className="relative z-10">{activeTenant.code}</span>
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-white truncate font-display">
                {activeTenant.name}
              </div>
              <div className="text-[11px] text-amber-200/75 truncate tabular mt-0.5">
                PPIU {activeTenant.ppiu} · {activeTenant.plan}
              </div>
            </div>
          </div>
        </div>

        <nav className="space-y-6" aria-label="Menu Utama ERP">
          {renderGroup('Operasional & Travel', operationalItems)}
          {renderGroup('Keuangan & Akuntansi', financeItems)}
          {renderGroup('Logistik, Agen & Tata Kelola', governanceItems)}
        </nav>
      </div>

      <div className="px-4 pt-4 border-t border-slate-800/80 space-y-3">
        <div className="px-1 text-[11px] text-slate-400 space-y-1 tabular">
          <div className="truncate">PIHK: {activeTenant.pihk}</div>
          <div>Kapasitas: {activeTenant.maxJamaahPerMonth} pax/bln</div>
        </div>
        <button
          type="button"
          onClick={onResetDemoData}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:text-white transition-colors duration-150 whitespace-nowrap"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar (Logout)
        </button>
      </div>
    </aside>
  );
};
