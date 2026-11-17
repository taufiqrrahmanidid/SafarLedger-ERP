import { useEffect, useMemo, useRef, useState } from 'react';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AccountingView } from './components/views/AccountingView';
import { AgentsIsoView } from './components/views/AgentsIsoView';
import { BookingsView } from './components/views/BookingsView';
import { DashboardView } from './components/views/DashboardView';
import { DmsView } from './components/views/DmsView';
import { InventoryView } from './components/views/InventoryView';
import { PaymentsView } from './components/views/PaymentsView';
import { SuperAdminView } from './components/views/SuperAdminView';
import { STANDARD_TRAVEL_COA } from './data/seedData';
import { api, apiRequest } from './services/api';
import { TenantUsersView } from './components/views/TenantUsersView';
import {
  DmsRecord,
  ErpTab,
  IncidentCategory,
  IsoIncident,
  PackageCategory,
  PaymentMethod,
  PaymentRecord,
  PlanTier,
  RoomType,
  Tenant,
  TenantWorkspaceData,
  SystemUser,
  UserRole,
} from './types/erp';
import {
  formatIDR,
  isPassportExpiringBeforeDeparture,
} from './utils/formatters';

interface WorkspaceApiResponse {
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
  tenant: Tenant;
  tenants?: Tenant[];
  workspace: TenantWorkspaceData;
}

const EMPTY_WORKSPACE: TenantWorkspaceData = {
  packages: [],
  departures: [],
  bookings: [],
  payments: [],
  coa: STANDARD_TRAVEL_COA.map((acc) => ({ ...acc, openingBalance: 0 })),
  journals: [],
  dmsRecords: [],
  inventory: [],
  agents: [],
  isoIncidents: [],
};

const ALLOWED_TABS_BY_ROLE: Record<UserRole, ErpTab[]> = {
  SUPER_ADMIN: ['dashboard', 'bookings', 'dms', 'payments', 'accounting', 'inventory', 'agents', 'superadmin'],
  OWNER: ['dashboard', 'bookings', 'dms', 'payments', 'accounting', 'inventory', 'agents', 'users'],
  OPS: ['bookings', 'dms', 'payments', 'inventory', 'agents'],
  FINANCE: ['payments', 'accounting', 'agents'],
  AGENT: ['bookings', 'agents'],
};

const DEFAULT_TAB_BY_ROLE: Record<UserRole, ErpTab> = {
  SUPER_ADMIN: 'dashboard',
  OWNER: 'dashboard',
  OPS: 'bookings',
  FINANCE: 'payments',
  AGENT: 'bookings',
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [workspace, setWorkspace] = useState<TenantWorkspaceData>(EMPTY_WORKSPACE);

  const [activeRole, setActiveRole] = useState<UserRole>('OWNER');
  const [currentTab, setCurrentTab] = useState<ErpTab>('dashboard');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [users, setUsers] = useState<SystemUser[]>([]);

  const dmsDebounceRef = useRef<Record<string, number>>({});

  const [tenantUsers, setTenantUsers] = useState<SystemUser[]>([]);

  const showFeedback = (message: string) => {
    setFeedbackBanner(message);
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev === message ? null : prev));
    }, 4500);
  };

  const updateActiveWorkspace = (
    updater: (prev: TenantWorkspaceData) => TenantWorkspaceData
  ) => {
    setWorkspace((prev) => updater(prev));
  };

  const fetchWorkspace = async () => {
    try {
      const data = await apiRequest<WorkspaceApiResponse>('/api/workspace');
      setActiveTenant(data.tenant);
      setTenants((prev) => {
        const exists = prev.some((t) => t.id === data.tenant.id);
        return exists
          ? prev.map((t) => (t.id === data.tenant.id ? data.tenant : t))
          : [data.tenant, ...prev];
      });
      setCurrentUserId(data.user.id);
      setActiveRole(data.user.role);
      setActiveTenant(data.tenant);
      setTenants(data.tenants && data.tenants.length > 0 ? data.tenants : [data.tenant]);
      setWorkspace(data.workspace);

      if (data.user.role === 'SUPER_ADMIN') {
        try {
          const allUsers = await api.listUsers();
          setUsers(allUsers);
        } catch {
          // Abaikan
        }
        setTenantUsers([]);
      } else if (data.user.role === 'OWNER') {
        setUsers([]);
        try {
          const staffUsers = await api.listTenantUsers();
          setTenantUsers(staffUsers);
        } catch {
          // Abaikan
        }
      } else {
        setUsers([]);
        setTenantUsers([]);
      }
      setActiveRole(data.user.role);
      setCurrentTab((prev) =>
        ALLOWED_TABS_BY_ROLE[data.user.role].includes(prev)
          ? prev
          : DEFAULT_TAB_BY_ROLE[data.user.role]
      );
      setAuthRequired(false);
    } catch (err: any) {
      if (err.message === 'UNAUTHORIZED') {
        setAuthRequired(true);
      } else {
        showFeedback(`Gagal memuat data server: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, []);

  useEffect(() => {
    if (activeTenant?.primaryColor) {
      document.documentElement.style.setProperty(
        '--brand-primary',
        activeTenant.primaryColor
      );
    }
  }, [activeTenant?.primaryColor]);

  // Alert counters
  const expiredPassportCount = useMemo(
    () =>
      workspace.dmsRecords.filter((d) =>
        isPassportExpiringBeforeDeparture(d.passportExpiry, d.departureDate)
      ).length,
    [workspace.dmsRecords]
  );

  const openIsoCount = useMemo(
    () => workspace.isoIncidents.filter((i) => i.status !== 'RESOLVED').length,
    [workspace.isoIncidents]
  );

  const lowStockCount = useMemo(
    () => workspace.inventory.filter((i) => i.qty < i.minStock).length,
    [workspace.inventory]
  );

  const allowedTabs = ALLOWED_TABS_BY_ROLE[activeRole];

  const handleNavigateTab = (tab: ErpTab) => {
    if (allowedTabs.includes(tab)) {
      setCurrentTab(tab);
    }
  };

  // ==========================================================
  // HANDLER TERHUBUNG KE POSTGRESQL (server.ts)
  // ==========================================================

  const handleCreateBooking = async (input: {
    jamaahName: string;
    nikRaw: string;
    phone: string;
    gender: 'L' | 'P';
    departureId: string;
    roomType: RoomType;
    mahramGroup: string;
    agentId: string;
    passportNo: string;
    passportExpiry: string;
  }) => {
    try {
      await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          jamaahName: input.jamaahName,
          nikRaw: input.nikRaw,
          phone: input.phone,
          gender: input.gender,
          departureId: input.departureId,
          roomType: input.roomType,
          mahramGroup: input.mahramGroup,
          agentId: input.agentId || undefined,
        }),
      });
      await fetchWorkspace();
      showFeedback(`Jamaah ${input.jamaahName} berhasil tersimpan ke PostgreSQL.`);
    } catch (err: any) {
      showFeedback(`Gagal mendaftarkan jamaah: ${err.message}`);
    }
  };

  const handleRecordPayment = async (input: {
    bookingId: string;
    amount: number;
    method: PaymentMethod;
  }): Promise<PaymentRecord | null> => {
    try {
      const created = await apiRequest<PaymentRecord>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await fetchWorkspace();
      showFeedback(
        `Pembayaran ${formatIDR(input.amount)} berhasil disimpan & terjurnal SAK ETAP.`
      );
      return created;
    } catch (err: any) {
      showFeedback(`Gagal memproses pembayaran: ${err.message}`);
      return null;
    }
  };

  // 1. Create Departure (Kloter) -> PostgreSQL
  const handleCreateDeparture = async (input: {
    packageId: string;
    kloterCode: string;
    airline: string;
    departureDate: string;
    returnDate: string;
    totalSeats: number;
  }) => {
    try {
      const created = await api.createDeparture(input);
      updateActiveWorkspace((prev) => ({
        ...prev,
        departures: [created, ...prev.departures],
      }));
      showFeedback(
        `Kloter ${created.kloterCode} berhasil disimpan ke database (${created.totalSeats} seat).`
      );
    } catch (err: any) {
      showFeedback(`Gagal buat kloter: ${err.message}`);
    }
  };

  // 2. Dispatch Departure (SAK ETAP Revenue Recognition) -> PostgreSQL
  const handleDispatchDeparture = async (departureId: string) => {
    try {
      const res = await api.dispatchDeparture(departureId);
      updateActiveWorkspace((prev) => ({
        ...prev,
        departures: prev.departures.map((d) =>
          d.id === departureId ? res.departure : d
        ),
        journals: res.journal ? [res.journal, ...prev.journals] : prev.journals,
      }));
      showFeedback(
        `Kloter ${res.departure.kloterCode} diberangkatkan. Pendapatan ${formatIDR(res.recognizedAmount)} diakui sesuai SAK ETAP.`
      );
    } catch (err: any) {
      showFeedback(`Gagal berangkatkan kloter: ${err.message}`);
    }
  };

  // 3. Rooming & Create Package -> PostgreSQL
  const handleUpdateRooming = async (
    bookingId: string,
    roomNumber: string,
    mahramGroup: string
  ) => {
    updateActiveWorkspace((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) =>
        b.id === bookingId ? { ...b, roomNumber, mahramGroup } : b
      ),
    }));
    try {
      await api.updateRooming(bookingId, roomNumber, mahramGroup);
    } catch (err: any) {
      showFeedback(`Gagal menyimpan rooming: ${err.message}`);
    }
  };

  const handleCreatePackage = async (input: {
    code: string;
    name: string;
    category: PackageCategory;
    durationDays: number;
    priceQuad: number;
    priceTriple: number;
    priceDouble: number;
    hppEstimate: number;
    hotelMakkah: string;
    hotelMadinah: string;
  }) => {
    try {
      const created = await api.createPackage(input);
      updateActiveWorkspace((prev) => ({
        ...prev,
        packages: [created, ...prev.packages],
      }));
      showFeedback(`Paket ${created.code} berhasil ditambahkan ke database.`);
    } catch (err: any) {
      showFeedback(`Gagal membuat paket: ${err.message}`);
    }
  };

  // 4. Record Manual Expense -> PostgreSQL
  const handleRecordExpense = async (input: {
    description: string;
    expenseAccountCode: string;
    paymentAccountCode: string;
    amount: number;
    kloterCode?: string;
  }) => {
    try {
      const journal = await api.createExpense(input);
      updateActiveWorkspace((prev) => ({
        ...prev,
        journals: [journal, ...prev.journals],
      }));
      showFeedback(
        `Jurnal pengeluaran ${formatIDR(input.amount)} berhasil disimpan ke database.`
      );
    } catch (err: any) {
      showFeedback(`Gagal mencatat pengeluaran: ${err.message}`);
    }
  };

  // 5. DMS Update (Optimistic + Debounce untuk ketikan No. Paspor) -> PostgreSQL
  const handleUpdateDocument = (
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
  ) => {
    updateActiveWorkspace((prev) => ({
      ...prev,
      dmsRecords: prev.dmsRecords.map((d) =>
        d.id === docId ? { ...d, ...patch } : d
      ),
    }));

    const isTextInput = 'passportNo' in patch || 'passportExpiry' in patch;
    const sendPatch = async () => {
      try {
        await api.updateDms(docId, patch);
      } catch (err: any) {
        showFeedback(`Gagal simpan berkas DMS: ${err.message}`);
      }
    };

    if (isTextInput) {
      window.clearTimeout(dmsDebounceRef.current[docId]);
      dmsDebounceRef.current[docId] = window.setTimeout(() => {
        void sendPatch();
      }, 500);
    } else {
      void sendPatch();
    }
  };

  // 6. Inventory Assembly, Restock & Kit Handover -> PostgreSQL
  const handleAssembleBundle = async (quantity: number) => {
    try {
      const updatedItems = await api.assembleBundle(quantity);
      updateActiveWorkspace((prev) => ({ ...prev, inventory: updatedItems }));
      showFeedback(`${quantity} set Paket Perlengkapan berhasil dirakit.`);
    } catch (err: any) {
      showFeedback(`Gagal assembly gudang: ${err.message}`);
    }
  };

  const handleRestockItem = async (itemId: string, addQty: number) => {
    try {
      const updated = await api.restockInventory(itemId, addQty);
      updateActiveWorkspace((prev) => ({
        ...prev,
        inventory: prev.inventory.map((i) => (i.id === itemId ? updated : i)),
      }));
      showFeedback(`Stok barang ditambah +${addQty} pcs.`);
    } catch (err: any) {
      showFeedback(`Gagal restock: ${err.message}`);
    }
  };

  const handleDispatchKitToJamaah = async (bookingId: string) => {
    try {
      const res = await api.dispatchKit(bookingId);
      updateActiveWorkspace((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) =>
          b.id === bookingId ? res.booking : b
        ),
        inventory: prev.inventory.map((i) =>
          i.id === res.bundle.id ? res.bundle : i
        ),
      }));
      showFeedback(
        `1 set perlengkapan diserahkan kepada ${res.booking.jamaahName}.`
      );
    } catch (err: any) {
      showFeedback(`Gagal serah terima kit: ${err.message}`);
    }
  };

  // 7. Agency Commission, Agents & ISO SLA -> PostgreSQL
  const handleDisburseCommission = async (agentId: string) => {
    try {
      const res = await api.disburseCommission(agentId);
      updateActiveWorkspace((prev) => ({
        ...prev,
        agents: prev.agents.map((a) => (a.id === agentId ? res.agent : a)),
        journals: [res.journal, ...prev.journals],
      }));
      showFeedback(
        `Komisi ${formatIDR(res.paidAmount)} dicairkan kepada ${res.agent.name}.`
      );
    } catch (err: any) {
      showFeedback(`Gagal cairkan komisi: ${err.message}`);
    }
  };

  const handleCreateAgent = async (input: {
    name: string;
    phone: string;
    parentAgentId?: string;
    directCommissionRate: number;
  }) => {
    try {
      const created = await api.createAgent(input);
      updateActiveWorkspace((prev) => ({
        ...prev,
        agents: [created, ...prev.agents],
      }));
      showFeedback(
        `Agen ${created.name} (${created.code}) berhasil didaftarkan.`
      );
    } catch (err: any) {
      showFeedback(`Gagal tambah agen: ${err.message}`);
    }
  };

  const handleUpdateIncidentStatus = async (
    incidentId: string,
    status: IsoIncident['status'],
    resolutionNotes?: string
  ) => {
    try {
      const updated = await api.updateIncident(
        incidentId,
        status,
        resolutionNotes
      );
      updateActiveWorkspace((prev) => ({
        ...prev,
        isoIncidents: prev.isoIncidents.map((inc) =>
          inc.id === incidentId ? updated : inc
        ),
      }));
      showFeedback('Tiket SLA ISO 9001:2015 diperbarui.');
    } catch (err: any) {
      showFeedback(`Gagal update SLA: ${err.message}`);
    }
  };

  const handleCreateIncident = async (input: {
    kloterCode: string;
    category: IncidentCategory;
    description: string;
    slaDeadline: string;
  }) => {
    try {
      const created = await api.createIncident(input);
      updateActiveWorkspace((prev) => ({
        ...prev,
        isoIncidents: [created, ...prev.isoIncidents],
      }));
      showFeedback(`Tiket SLA ${created.ticket} diterbitkan.`);
    } catch (err: any) {
      showFeedback(`Gagal membuat tiket SLA: ${err.message}`);
    }
  };

  const handleCreateTenantUser = async (input: {
    name: string;
    email: string;
    password: string;
    role: 'OPS' | 'FINANCE' | 'AGENT';
  }) => {
    try {
      const created = await api.createTenantUser(input);
      setTenantUsers((prev) => [created, ...prev]);
      showFeedback(`Akun staf ${created.email} (${created.role}) berhasil dibuat.`);
    } catch (err: any) {
      showFeedback(err.message || 'Gagal membuat akun staf.');
      throw err;
    }
  };

  const handleUpdateTenantUser = async (
    userId: string,
    patch: {
      name?: string;
      role?: 'OPS' | 'FINANCE' | 'AGENT';
      isActive?: boolean;
      password?: string;
    }
  ) => {
    try {
      const updated = await api.updateTenantUser(userId, patch);
      setTenantUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      showFeedback(`Akun staf ${updated.email} berhasil diperbarui.`);
    } catch (err: any) {
      showFeedback(err.message || 'Gagal memperbarui akun staf.');
      throw err;
    }
  };

  const handleDeleteTenantUser = async (userId: string) => {
    try {
      await api.deleteTenantUser(userId);
      setTenantUsers((prev) => prev.filter((u) => u.id !== userId));
      showFeedback('Akun staf berhasil dihapus.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal menghapus akun staf.');
      throw err;
    }
  };

  // 8. Super-Admin Tenant Provisioning & Tema -> PostgreSQL
  const handleCreateTenant = async (input: {
    name: string;
    subdomain: string;
    ppiu: string;
    pihk: string;
    plan: PlanTier;
    primaryColor: string;
  }) => {
    try {
      const newTenant = await api.createTenant(input);
      setTenants((prev) => [...prev, newTenant]);
      showFeedback(
        `Tenant ${newTenant.name} berhasil diprovisioning ke PostgreSQL.`
      );
    } catch (err: any) {
      showFeedback(`Gagal provisioning tenant: ${err.message}`);
    }
  };

  const handleUpdateTenantTheme = async (
    tenantId: string,
    primaryColor: string
  ) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, primaryColor } : t))
    );
    setActiveTenant((prev) =>
      prev && prev.id === tenantId ? { ...prev, primaryColor } : prev
    );
    try {
      await api.updateTenantTheme(tenantId, primaryColor);
    } catch (err: any) {
      showFeedback(`Gagal update warna tema: ${err.message}`);
    }
  };

  const handleSwitchTenant = async (tenantId: string) => {
    try {
      const res = await api.switchTenant(tenantId);
      const data = await apiRequest<WorkspaceApiResponse>('/api/workspace');
      setCurrentUserId(data.user.id);
      setActiveRole(data.user.role);
      setActiveTenant(data.tenant);
      setTenants(data.tenants && data.tenants.length > 0 ? data.tenants : [data.tenant]);
      setWorkspace(data.workspace);
      if (data.user.role === 'SUPER_ADMIN') {
        try {
          const allUsers = await api.listUsers();
          setUsers(allUsers);
        } catch {
          // Abaikan jika gagal memuat daftar user
        }
      }
      showFeedback(`Berpindah workspace aktif ke ${res.tenant.name}.`);
    } catch (err: any) {
      showFeedback(err.message || 'Gagal berpindah workspace tenant.');
    }
  };

  const handleCreateUser = async (input: {
    tenantId: string;
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) => {
    try {
      const created = await api.createUser(input);
      setUsers((prev) => [created, ...prev]);
      showFeedback(`Akun ${created.email} (${created.role}) berhasil dibuat.`);
    } catch (err: any) {
      showFeedback(err.message || 'Gagal membuat akun pengguna.');
      throw err;
    }
  };

  const handleUpdateUser = async (
    userId: string,
    patch: {
      name?: string;
      tenantId?: string;
      role?: UserRole;
      isActive?: boolean;
      password?: string;
    }
  ) => {
    try {
      const updated = await api.updateUser(userId, patch);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
      showFeedback(`Akun ${updated.email} berhasil diperbarui.`);
    } catch (err: any) {
      showFeedback(err.message || 'Gagal memperbarui akun pengguna.');
      throw err;
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showFeedback('Akun pengguna berhasil dihapus.');
    } catch (err: any) {
      showFeedback(err.message || 'Gagal menghapus akun pengguna.');
      throw err;
    }
  };

  const handleLogoutAndRefresh = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthRequired(true);
    setActiveTenant(null);
    setWorkspace(EMPTY_WORKSPACE);
  };

  // ==========================================================
  // RENDER STATE: LOADING / LOGIN / WORKSPACE
  // ==========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Memuat workspace SafarLedger ERP dari server...
      </div>
    );
  }

  if (authRequired || !activeTenant) {
    return <LoginView onLoginSuccess={fetchWorkspace} />;
  }

  const handleUploadDmsFile = async (
    dmsId: string,
    docType: 'KTP' | 'KK' | 'PASPOR' | 'MENINGITIS',
    file: File
  ) => {
    try {
      const { uploadUrl, objectKey } = await apiRequest<{
        uploadUrl: string;
        objectKey: string;
      }>('/api/dms/upload-url', {
        method: 'POST',
        body: JSON.stringify({
          dmsId,
          docType,
          mimeType: file.type,
          fileSize: file.size,
        }),
      });

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Gagal mengunggah file ke storage.');

      await apiRequest(`/api/dms/${dmsId}/attach`, {
        method: 'PATCH',
        body: JSON.stringify({ docType, objectKey }),
      });

      await fetchWorkspace();
      showFeedback(`Berkas ${docType} berhasil diunggah ke storage terenkripsi.`);
    } catch (err: any) {
      showFeedback(`Upload gagal: ${err.message}`);
    }
  };

  const handleViewDmsFile = async (
    dmsId: string,
    docType: 'KTP' | 'KK' | 'PASPOR' | 'MENINGITIS'
  ) => {
    try {
      const { viewUrl } = await apiRequest<{ viewUrl: string }>(
        `/api/dms/${dmsId}/view-url?docType=${docType}`
      );
      const link = document.createElement('a');
      link.href = viewUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (err: any) {
      showFeedback(`Gagal membuka dokumen: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        tenants={tenants}
        selectedTenantId={activeTenant.id}
        onChangeTenant={activeRole === 'SUPER_ADMIN' ? handleSwitchTenant : undefined}
        activeRole={activeRole}
        allowedTabs={allowedTabs}
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        onOpenQuickRegister={() => handleNavigateTab('bookings')}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeTenant={activeTenant}
          activeRole={activeRole}
          currentTab={currentTab}
          onSelectTab={handleNavigateTab}
          expiredPassportCount={expiredPassportCount}
          openIsoCount={openIsoCount}
          lowStockCount={lowStockCount}
          onResetDemoData={handleLogoutAndRefresh}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-7 max-w-7xl mx-auto w-full space-y-6">
          {feedbackBanner && (
            <div
              role="status"
              className="no-print bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-800 flex items-center justify-between gap-4 shadow-xs"
            >
              <span className="font-medium">{feedbackBanner}</span>
              <button
                type="button"
                onClick={() => setFeedbackBanner(null)}
                className="text-slate-500 hover:text-slate-900 font-semibold"
              >
                Tutup
              </button>
            </div>
          )}

          {currentTab === 'dashboard' && allowedTabs.includes('dashboard') && (
            <DashboardView
              tenant={activeTenant}
              coa={workspace.coa}
              departures={workspace.departures}
              packages={workspace.packages}
              bookings={workspace.bookings}
              journals={workspace.journals}
              expiredPassportCount={expiredPassportCount}
              openIsoCount={openIsoCount}
              onDispatchDeparture={handleDispatchDeparture}
              onCreateDeparture={handleCreateDeparture}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {currentTab === 'bookings' && allowedTabs.includes('bookings') && (
            <BookingsView
              tenant={activeTenant}
              packages={workspace.packages}
              departures={workspace.departures}
              bookings={workspace.bookings}
              agents={workspace.agents}
              onCreateBooking={handleCreateBooking}
              onUpdateRooming={handleUpdateRooming}
              onCreatePackage={handleCreatePackage}
            />
          )}

          {currentTab === 'dms' && allowedTabs.includes('dms') && (
            <DmsView
              dmsRecords={workspace.dmsRecords}
              onUpdateDocument={handleUpdateDocument}
              onUploadFile={handleUploadDmsFile}
              onViewFile={handleViewDmsFile}
            />
          )}

          {currentTab === 'payments' && allowedTabs.includes('payments') && (
            <PaymentsView
              tenant={activeTenant}
              bookings={workspace.bookings}
              payments={workspace.payments}
              onRecordPayment={handleRecordPayment}
            />
          )}

          {currentTab === 'accounting' && allowedTabs.includes('accounting') && (
            <AccountingView
              tenant={activeTenant}
              coa={workspace.coa}
              journals={workspace.journals}
              departures={workspace.departures}
              onRecordExpense={handleRecordExpense}
            />
          )}

          {currentTab === 'inventory' && allowedTabs.includes('inventory') && (
            <InventoryView
              tenant={activeTenant}
              inventory={workspace.inventory}
              bookings={workspace.bookings}
              onAssembleBundle={handleAssembleBundle}
              onRestockItem={handleRestockItem}
              onDispatchKitToJamaah={handleDispatchKitToJamaah}
            />
          )}

          {currentTab === 'agents' && allowedTabs.includes('agents') && (
            <AgentsIsoView
              tenant={activeTenant}
              agents={workspace.agents}
              isoIncidents={workspace.isoIncidents}
              departures={workspace.departures}
              onDisburseCommission={handleDisburseCommission}
              onCreateAgent={handleCreateAgent}
              onUpdateIncidentStatus={handleUpdateIncidentStatus}
              onCreateIncident={handleCreateIncident}
            />
          )}

          {currentTab === 'users' && activeRole === 'OWNER' && (
            <TenantUsersView
              tenant={activeTenant}
              currentUserId={currentUserId}
              users={tenantUsers}
              onCreateUser={handleCreateTenantUser}
              onUpdateUser={handleUpdateTenantUser}
              onDeleteUser={handleDeleteTenantUser}
            />
          )}

          {currentTab === 'superadmin' && activeRole === 'SUPER_ADMIN' && (
            <SuperAdminView
              tenants={tenants}
              activeTenantId={activeTenant.id}
              currentUserId={currentUserId}
              users={users}
              onSelectTenant={async (id) => {
                await handleSwitchTenant(id);
                handleNavigateTab('dashboard');
              }}
              onCreateTenant={handleCreateTenant}
              onUpdateTenantTheme={handleUpdateTenantTheme}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}
        </main>
      </div>
    </div>
  );
}