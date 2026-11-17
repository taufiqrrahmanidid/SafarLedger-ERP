import React, { useMemo, useState } from 'react';
import { KeyRound, Plus, Shield, Trash2, UserPlus } from 'lucide-react';
import { SystemUser, Tenant, UserRole } from '../../types/erp';

interface TenantUsersViewProps {
    tenant: Tenant;
    currentUserId: string;
    users: SystemUser[];
    onCreateUser: (input: {
        name: string;
        email: string;
        password: string;
        role: 'OPS' | 'FINANCE' | 'AGENT';
    }) => Promise<void>;
    onUpdateUser: (
        userId: string,
        patch: {
            name?: string;
            role?: 'OPS' | 'FINANCE' | 'AGENT';
            isActive?: boolean;
            password?: string;
        }
    ) => Promise<void>;
    onDeleteUser: (userId: string) => Promise<void>;
}

const STAFF_ROLES: { value: 'OPS' | 'FINANCE' | 'AGENT'; label: string; desc: string }[] = [
    { value: 'OPS', label: 'Admin Operasional', desc: 'Manifes, Paspor/DMS, Gudang & ISO SLA' },
    { value: 'FINANCE', label: 'Kasir / Akuntansi', desc: 'Kasir Pembayaran, Kuitansi QR & SAK ETAP' },
    { value: 'AGENT', label: 'Portal Agen', desc: 'Pendaftaran Jamaah & Komisi Keagenan' },
];

const ROLE_BADGE: Record<UserRole, string> = {
    SUPER_ADMIN: 'bg-slate-900 text-white',
    OWNER: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    OPS: 'bg-sky-50 text-sky-800 border border-sky-200',
    FINANCE: 'bg-amber-50 text-amber-800 border border-amber-200',
    AGENT: 'bg-violet-50 text-violet-800 border border-violet-200',
};

export const TenantUsersView: React.FC<TenantUsersViewProps> = ({
    tenant,
    currentUserId,
    users,
    onCreateUser,
    onUpdateUser,
    onDeleteUser,
}) => {
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'OPS' as 'OPS' | 'FINANCE' | 'AGENT',
    });
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');

    // Modal Edit
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState<'OPS' | 'FINANCE' | 'AGENT'>('OPS');
    const [editPassword, setEditPassword] = useState('');
    const [saving, setSaving] = useState(false);

    // Modal Konfirmasi Hapus
    const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
    const [deleting, setDeleting] = useState(false);

    const visibleUsers = useMemo(() => {
        const q = search.trim().toLowerCase();
        return users.filter(
            (u) =>
                u.role !== 'SUPER_ADMIN' &&
                (!q ||
                    u.name.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q) ||
                    u.role.toLowerCase().includes(q))
        );
    }, [users, search]);

    const handleSubmitCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.email.trim() || form.password.length < 8) return;
        setSubmitting(true);
        try {
            await onCreateUser(form);
            setForm({ name: '', email: '', password: '', role: 'OPS' });
        } finally {
            setSubmitting(false);
        }
    };

    const openEdit = (u: SystemUser) => {
        if (u.role !== 'OPS' && u.role !== 'FINANCE' && u.role !== 'AGENT') return;
        setEditingUser(u);
        setEditName(u.name);
        setEditRole(u.role);
        setEditPassword('');
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        setSaving(true);
        try {
            await onUpdateUser(editingUser.id, {
                name: editName.trim(),
                role: editRole,
                password: editPassword.trim() ? editPassword.trim() : undefined,
            });
            setEditingUser(null);
            setEditPassword('');
        } finally {
            setSaving(false);
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 font-display">
                        Kelola Akun Staf &amp; Hak Akses — {tenant.name}
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Buat, ubah role, reset password, atau hapus akun staf operasional, keuangan, dan agen cabang (maksimal {tenant.maxUsers} akun).
                    </p>
                </div>
                <div className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-3.5 py-2 tabular shrink-0">
                    Kuota Akun: <span className="font-bold text-slate-900">{visibleUsers.length}</span> / {tenant.maxUsers}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Tambah Staf */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <UserPlus className="w-4 h-4 text-slate-700" />
                        <h2 className="text-sm font-semibold text-slate-900 font-display">
                            Tambah Akun Staf Baru
                        </h2>
                    </div>

                    <form onSubmit={handleSubmitCreate} className="space-y-3.5 text-xs">
                        <div>
                            <label className="block text-slate-600 font-medium mb-1">Nama Lengkap Staf</label>
                            <input
                                type="text"
                                required
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Contoh: Siti Rahmawati"
                                className="w-full h-9 border border-slate-200 rounded-lg px-3"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-medium mb-1">Email Login</label>
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="staf@travelanda.co.id"
                                className="w-full h-9 border border-slate-200 rounded-lg px-3"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-medium mb-1">Password Awal (Min. 8 Karakter)</label>
                            <input
                                type="password"
                                required
                                minLength={8}
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                placeholder="Minimal 8 karakter"
                                className="w-full h-9 border border-slate-200 rounded-lg px-3"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-600 font-medium mb-1">Divisi / Role Akses</label>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value as 'OPS' | 'FINANCE' | 'AGENT' })}
                                className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                            >
                                {STAFF_ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label} ({r.value})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-400 mt-1">
                                {STAFF_ROLES.find((r) => r.value === form.role)?.desc}
                            </p>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-10 text-xs font-semibold text-white rounded-lg inline-flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-xs"
                            style={{ backgroundColor: tenant.primaryColor }}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            {submitting ? 'Menyimpan...' : 'Buat Akun Staf'}
                        </button>
                    </form>
                </div>

                {/* Tabel Daftar Akun Perusahaan */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)] h-fit">
                    <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-slate-900 font-display">
                            Daftar Akun Perusahaan ({visibleUsers.length})
                        </h2>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari nama, email, atau role..."
                            className="h-8 border border-slate-200 rounded-lg px-3 text-xs w-full sm:w-56"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-medium">
                                    <th className="py-3 px-5">Nama &amp; Email</th>
                                    <th className="py-3 px-4">Role</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-5 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {visibleUsers.map((u) => {
                                    const isStaff = u.role === 'OPS' || u.role === 'FINANCE' || u.role === 'AGENT';
                                    const isSelf = u.id === currentUserId;

                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3.5 px-5">
                                                <div className="font-semibold text-slate-900">
                                                    {u.name} {isSelf && <span className="text-[11px] text-emerald-700">(Anda)</span>}
                                                </div>
                                                <div className="text-[11px] font-mono-code text-slate-500">{u.email}</div>
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${ROLE_BADGE[u.role]}`}
                                                >
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <span className={`font-semibold ${u.isActive ? 'text-emerald-700' : 'text-red-600'}`}>
                                                    {u.isActive ? 'Aktif' : 'Nonaktif'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-5 text-right whitespace-nowrap space-x-1.5">
                                                {isStaff ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEdit(u)}
                                                            className="px-2.5 py-1 border border-slate-200 bg-white rounded-lg text-[11px] font-medium text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                                                        >
                                                            <KeyRound className="w-3 h-3" />
                                                            Edit / Reset PW
                                                        </button>
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
                                                            title="Hapus akun staf"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                                        <Shield className="w-3 h-3" />
                                                        Akun Direksi
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {visibleUsers.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-slate-400">
                                            Belum ada akun staf terdaftar.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal Edit Staf */}
            {editingUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
                        <div className="border-b border-slate-100 pb-3">
                            <h3 className="text-sm font-bold text-slate-900 font-display">
                                Edit Akun Staf: {editingUser.name}
                            </h3>
                            <p className="text-[11px] font-mono-code text-slate-500 mt-0.5">{editingUser.email}</p>
                        </div>
                        <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
                            <div>
                                <label className="block text-slate-600 font-medium mb-1">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full h-9 border border-slate-200 rounded-lg px-3"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-600 font-medium mb-1">Divisi / Role</label>
                                <select
                                    value={editRole}
                                    onChange={(e) => setEditRole(e.target.value as 'OPS' | 'FINANCE' | 'AGENT')}
                                    className="w-full h-9 border border-slate-200 rounded-lg px-2.5 bg-white"
                                >
                                    {STAFF_ROLES.map((r) => (
                                        <option key={r.value} value={r.value}>
                                            {r.label} ({r.value})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-600 font-medium mb-1">
                                    Password Baru (Kosongkan jika tidak diganti)
                                </label>
                                <input
                                    type="password"
                                    minLength={8}
                                    value={editPassword}
                                    onChange={(e) => setEditPassword(e.target.value)}
                                    placeholder="Minimal 8 karakter"
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
                                    disabled={saving}
                                    className="h-9 px-4 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
                                >
                                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Konfirmasi Hapus */}
            {deletingUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4 shadow-xl">
                        <h3 className="text-sm font-bold text-slate-900 font-display">Hapus Akun Staf?</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            Akun <span className="font-semibold text-slate-900">{deletingUser.name}</span> (
                            <span className="font-mono-code">{deletingUser.email}</span>) akan dihapus permanen dan tidak dapat login kembali.
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