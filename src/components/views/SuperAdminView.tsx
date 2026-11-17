import React, { useMemo, useState } from 'react';
import { Building2, KeyRound, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { PlanTier, SystemUser, Tenant, UserRole } from '../../types/erp';

interface SuperAdminViewProps {
  tenants: Tenant[];
  activeTenantId: string;
  currentUserId: string;
  users: SystemUser[];
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
  onCreateUser: (input: {
    tenantId: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<void>;
  onUpdateUser: (
    userId: string,
    patch: {
      name?: string;
      tenantId?: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    }
  ) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
}

const PRESET_COLORS = [
  { label: 'Emerald Haramain', hex: '#0F4C3A' },
  { label: 'Deep Navy', hex: '#1E3A5F' },
  { label: 'Slate Charcoal', hex: '#1E293B' },
  { label: 'Bronze Umrah', hex: '#78350F' },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'OWNER', label: 'Owner / Direksi' },
  { value: 'OPS', label: 'Admin Operasional' },
  { value: 'FINANCE', label: 'Kasir / Akuntansi' },
  { value: 'AGENT', label: 'Portal Agen' },
  { value: 'SUPER_ADMIN', label: 'Super-Admin (Developer)' },
];

const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-slate-900 text-white',
  OWNER: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  OPS: 'bg-sky-50 text-sky-800 border border-sky-200',
  FINANCE: 'bg-amber-50 text-amber-800 border border-amber-200',
  AGENT: 'bg-violet-50 text-violet-800 border border-violet-200',
};

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  tenants,
  activeTenantId,
  currentUserId,
  users,
  onSelectTenant,
  onCreateTenant,
  onUpdateTenantTheme,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [subTab, setSubTab] = useState<'TENANTS' | 'USERS'>('TENANTS');

  // Form Tenant Baru
  const [form, setForm] = useState({
    name: '',
    subdomain: '',
    ppiu: '',
    pihk: 'Belum Terdaftar',
    plan: 'PRO' as PlanTier,
    primaryColor: '#0F4C3A',
  });

  // Form User Baru
  const [userForm, setUserForm] = useState({
    tenantId: activeTenantId || tenants[0]?.id || '',
    name: '',
    email: '',
    password: '',
    role: 'OWNER' as UserRole,
  });
  const [userSubmitting, setUserSubmitting] = useState(false);

  // Filter & Search Tabel Users
  const [filterTenantId, setFilterTenantId] = useState<string>('ALL');
  const [userSearch, setUserSearch] = useState('');

  // Modal Edit / Reset Password User
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('OWNER');
  const [editTenantId, setEditTenantId] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Modal Konfirmasi Hapus User
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return users.filter((u) => {
      const matchTenant = filterTenantId === 'ALL' || u.tenantId === filterTenantId;
      const matchQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q);
      return matchTenant && matchQuery;
    });
  }, [users, filterTenantId, userSearch]);

  const handleSubmitTenant = (e: React.FormEvent) => {
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

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.tenantId || !userForm.name.trim() || !userForm.email.trim() || userForm.password.length < 8) {
      return;
    }
    setUserSubmitting(true);
    try {
      await onCreateUser(userForm);
      setUserForm((prev) => ({
        ...prev,
        name: '',
        email: '',
        password: '',
      }));
    } finally {
      setUserSubmitting(false);
    }
  };

  const openEditModal = (u: SystemUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditTenantId(u.tenantId);
    setEditPassword('');
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSaving(true);
    try {
      await onUpdateUser(editingUser.id, {
        role: editRole,
        tenantId: editTenantId,
        password: editPassword.trim() ? editPassword.trim() : undefined,
      });
      setEditingUser(null);
      setEditPassword('');
    } finally {
      setEditSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await onDeleteUser(deletingUser.id);
      setDeletingUser(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">
            Super-Admin Control Center: Tenant SaaS &amp; Akun Sistem
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hak akses tertinggi developer untuk provisioning biro travel, berpindah workspace client, dan mengelola seluruh akun pengguna sistem.
          </p>
        </div>

        <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('TENANTS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${subTab === 'TENANTS'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Biro Travel ({tenants.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('USERS')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all ${subTab === 'USERS'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Users className="w-3.5 h-3.5" />
            Akun Pengguna ({users.length})
          </button>
        </div>
      </div>

      {subTab === 'TENANTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
            <h2 className="text-sm font-semibold text-slate-900 font-display border-b border-slate-100 pb-3">
              Provisioning Biro Travel Baru
            </h2>
            <form onSubmit={handleSubmitTenant} className="space-y-3.5 text-xs">
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
                        className={`w-6 h-6 rounded-md border ${form.primaryColor === c.hex
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
                                className={`w-5 h-5 rounded-md border ${t.primaryColor === c.hex
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
                            <span className="text-emerald-700 font-semibold">Workspace Aktif</span>
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
      )}

      {subTab === 'USERS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Buat Akun Pengguna Baru
              </h2>
            </div>

            <form onSubmit={handleSubmitUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Perusahaan / Tenant</label>
                <select
                  required
                  value={userForm.tenantId}
                  onChange={(e) => setUserForm({ ...userForm, tenantId: e.target.value })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.subdomain})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="Contoh: H. Budi Santoso"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Email Login</label>
                <input
                  type="email"
                  required
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="owner@travelanda.co.id"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Password Awal (Min. 8 Karakter)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder="Minimal 8 karakter"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Role / Hak Akses</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hanya Super-Admin yang dapat membuat akun &amp; menetapkan role Super-Admin.
                </p>
              </div>
              <button
                type="submit"
                disabled={userSubmitting}
                className="w-full h-10 text-xs font-semibold text-white rounded-lg inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {userSubmitting ? 'Menyimpan...' : 'Buat Akun Pengguna'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900 font-display">
                Daftar Seluruh Akun Sistem ({filteredUsers.length})
              </h2>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari nama / email..."
                  className="h-8 border border-slate-200 rounded-lg px-2.5 w-40"
                />
                <select
                  value={filterTenantId}
                  onChange={(e) => setFilterTenantId(e.target.value)}
                  className="h-8 border border-slate-200 rounded-lg px-2 bg-white max-w-[160px]"
                >
                  <option value="ALL">Semua Tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                    <th className="py-3 px-5">Pengguna</th>
                    <th className="py-3 px-4">Tenant</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="font-semibold text-slate-900">
                            {u.name} {isSelf && <span className="text-[11px] text-emerald-700">(Anda)</span>}
                          </div>
                          <div className="text-[11px] font-mono-code text-slate-500">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {u.tenant?.name || tenants.find((t) => t.id === u.tenantId)?.name || '-'}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${ROLE_BADGE_STYLE[u.role]}`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`text-xs font-semibold ${u.isActive ? 'text-emerald-700' : 'text-red-600'
                              }`}
                          >
                            {u.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="px-2.5 py-1 border border-slate-200 bg-white rounded-lg text-[11px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                          >
                            <KeyRound className="w-3 h-3" />
                            Edit / Reset PW
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                onClick={() => onUpdateUser(u.id, { isActive: !u.isActive })}
                                className={`px-2.5 py-1 border rounded-lg text-[11px] font-medium ${u.isActive
                                    ? 'border-amber-200 text-amber-800 hover:bg-amber-50'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                  }`}
                              >
                                {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingUser(u)}
                                className="px-2 py-1 border border-red-200 text-red-700 rounded-lg text-[11px] font-medium hover:bg-red-50 inline-flex items-center"
                                title="Hapus akun pengguna"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Tidak ada akun pengguna yang sesuai filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Role / Tenant / Reset Password */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 font-display">
                Kelola Akun: {editingUser.name}
              </h3>
              <p className="text-[11px] font-mono-code text-slate-500 mt-0.5">
                {editingUser.email}
              </p>
            </div>
            <form onSubmit={handleSaveEditUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Tenant</label>
                <select
                  value={editTenantId}
                  onChange={(e) => setEditTenantId(e.target.value)}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Role Pengguna</label>
                <select
                  value={editRole}
                  disabled={editingUser.id === currentUserId}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white disabled:bg-slate-100"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">
                  Password Baru (Kosongkan jika tidak ingin mengubah)
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Minimal 8 karakter jika direset"
                  className="w-full h-9 border border-slate-200 rounded-lg px-3"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="h-9 px-3.5 border border-slate-200 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="h-9 px-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                >
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Hapus Akun */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 font-display">Hapus Akun Pengguna?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Akun <span className="font-semibold text-slate-900">{deletingUser.name}</span> (
              <span className="font-mono-code">{deletingUser.email}</span> · role{' '}
              <span className="font-semibold">{deletingUser.role}</span>) akan dihapus permanen dari sistem.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="h-9 px-3.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="h-9 px-4 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Akun'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};