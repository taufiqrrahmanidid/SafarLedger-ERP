import { useEffect, useMemo, useState } from 'react';
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
import {
  INITIAL_TENANTS,
  INITIAL_WORKSPACE_DATA,
  STANDARD_TRAVEL_COA,
} from './data/seedData';
import {
  Agent,
  Booking,
  Departure,
  DmsRecord,
  ErpTab,
  IncidentCategory,
  IsoIncident,
  JournalEntry,
  PackageCategory,
  PaymentMethod,
  PaymentRecord,
  PlanTier,
  RoomType,
  Tenant,
  TenantWorkspaceData,
  TravelPackage,
  UserRole,
} from './types/erp';
import {
  formatIDR,
  isPassportExpiringBeforeDeparture,
  maskNik,
} from './utils/formatters';

const STORAGE_KEY = 'safarledger_erp_v2';

interface PersistedState {
  tenants: Tenant[];
  workspaces: Record<string, TenantWorkspaceData>;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.tenants?.length && parsed.workspaces) {
        return parsed;
      }
    }
  } catch {
    // Fallback to seed data
  }
  return {
    tenants: INITIAL_TENANTS,
    workspaces: INITIAL_WORKSPACE_DATA,
  };
}

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadInitialState());
  const [selectedTenantId, setSelectedTenantId] = useState<string>(
    () => state.tenants[0]?.id || 't1'
  );
  const [activeRole, setActiveRole] = useState<UserRole>('OWNER');
  const [currentTab, setCurrentTab] = useState<ErpTab>('dashboard');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const activeTenant = useMemo(
    () => state.tenants.find((t) => t.id === selectedTenantId) || state.tenants[0],
    [state.tenants, selectedTenantId]
  );

  const workspace: TenantWorkspaceData = useMemo(
    () =>
      state.workspaces[activeTenant.id] || {
        packages: [],
        departures: [],
        bookings: [],
        payments: [],
        coa: STANDARD_TRAVEL_COA,
        journals: [],
        dmsRecords: [],
        inventory: [],
        agents: [],
        isoIncidents: [],
      },
    [state.workspaces, activeTenant.id]
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', activeTenant.primaryColor);
  }, [activeTenant.primaryColor]);

  const showFeedback = (message: string) => {
    setFeedbackBanner(message);
    window.setTimeout(() => {
      setFeedbackBanner((prev) => (prev === message ? null : prev));
    }, 4500);
  };

  const updateActiveWorkspace = (
    updater: (prev: TenantWorkspaceData) => TenantWorkspaceData
  ) => {
    setState((prev) => {
      const current = prev.workspaces[activeTenant.id];
      if (!current) return prev;
      return {
        ...prev,
        workspaces: {
          ...prev.workspaces,
          [activeTenant.id]: updater(current),
        },
      };
    });
  };

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

  const todayIso = '2026-11-15';

  // Role-based automatic tab fallback if user switches to a restricted role
  const handleChangeRole = (role: UserRole) => {
    setActiveRole(role);
    if (role === 'FINANCE' && (currentTab === 'dms' || currentTab === 'inventory' || currentTab === 'superadmin')) {
      setCurrentTab('accounting');
    } else if (role === 'AGENT' && currentTab !== 'dashboard' && currentTab !== 'bookings' && currentTab !== 'agents') {
      setCurrentTab('agents');
    } else if (role === 'SUPER_ADMIN') {
      setCurrentTab('superadmin');
    }
  };

  // 1. Create Departure (Kloter)
  const handleCreateDeparture = (input: {
    packageId: string;
    kloterCode: string;
    airline: string;
    departureDate: string;
    returnDate: string;
    totalSeats: number;
  }) => {
    const pkg = workspace.packages.find((p) => p.id === input.packageId);
    if (!pkg) return;

    const newDep: Departure = {
      id: `d-${Date.now()}`,
      tenantId: activeTenant.id,
      packageId: pkg.id,
      kloterCode: input.kloterCode.toUpperCase(),
      packageName: pkg.name,
      airline: input.airline,
      departureDate: input.departureDate,
      returnDate: input.returnDate,
      totalSeats: input.totalSeats,
      filledSeats: 0,
      estHppPerSeat: pkg.hppEstimate,
      status: 'OPEN',
    };

    updateActiveWorkspace((prev) => ({
      ...prev,
      departures: [newDep, ...prev.departures],
    }));
    showFeedback(`Kloter ${newDep.kloterCode} berhasil dibuka dengan kuota ${newDep.totalSeats} seat.`);
  };

  // 2. Dispatch Departure (SAK ETAP Revenue Recognition)
  const handleDispatchDeparture = (departureId: string) => {
    const dep = workspace.departures.find((d) => d.id === departureId);
    if (!dep || dep.status === 'DEPARTED') return;

    const kloterBookings = workspace.bookings.filter((b) => b.departureId === departureId);
    const recognizedAmount = kloterBookings.reduce((sum, b) => sum + b.paidAmount, 0);
    const totalHpp = dep.filledSeats * dep.estHppPerSeat;

    const journalLines = [];
    if (recognizedAmount > 0) {
      journalLines.push(
        {
          accountCode: '2-101',
          accountName: 'Uang Muka Jamaah (Liabilitas)',
          debit: recognizedAmount,
          credit: 0,
        },
        {
          accountCode: '4-101',
          accountName: 'Pendapatan Paket Umrah & Haji',
          debit: 0,
          credit: recognizedAmount,
        }
      );
    }
    if (totalHpp > 0) {
      journalLines.push(
        {
          accountCode: '5-101',
          accountName: 'Beban Pokok Penjualan (Tiket, Hotel, Visa)',
          debit: totalHpp,
          credit: 0,
        },
        {
          accountCode: '1-102',
          accountName: 'Bank Operasional Syariah (BSI)',
          debit: 0,
          credit: totalHpp,
        }
      );
    }

    const newJournal: JournalEntry | null =
      journalLines.length > 0
        ? {
            id: `j-${Date.now()}`,
            tenantId: activeTenant.id,
            entryNo: `REV-${dep.kloterCode}`,
            date: dep.departureDate,
            refType: 'DEPARTURE_RECOGNITION',
            kloterCode: dep.kloterCode,
            description: `Pengakuan Pendapatan & HPP Kloter ${dep.kloterCode} (${dep.filledSeats} Jamaah Berangkat)`,
            lines: journalLines,
          }
        : null;

    updateActiveWorkspace((prev) => ({
      ...prev,
      departures: prev.departures.map((d) =>
        d.id === departureId ? { ...d, status: 'DEPARTED' } : d
      ),
      journals: newJournal ? [newJournal, ...prev.journals] : prev.journals,
    }));

    showFeedback(
      `Kloter ${dep.kloterCode} diberangkatkan. Pendapatan ${formatIDR(recognizedAmount)} diakui sesuai SAK ETAP.`
    );
  };

  // 3. Create Booking + DMS + Agency Commission Accrual
  const handleCreateBooking = (input: {
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
    const dep = workspace.departures.find((d) => d.id === input.departureId);
    const pkg = workspace.packages.find((p) => p.id === dep?.packageId);
    if (!dep || !pkg) return;

    const totalAmount =
      input.roomType === 'DOUBLE'
        ? pkg.priceDouble
        : input.roomType === 'TRIPLE'
        ? pkg.priceTriple
        : pkg.priceQuad;

    const bookingId = `b-${Date.now()}`;
    const bookingNo = `BK-2611-${String(workspace.bookings.length + 1).padStart(3, '0')}`;

    const newBooking: Booking = {
      id: bookingId,
      tenantId: activeTenant.id,
      bookingNo,
      departureId: dep.id,
      kloterCode: dep.kloterCode,
      jamaahName: input.jamaahName.trim(),
      nikMasked: maskNik(input.nikRaw),
      phone: input.phone,
      gender: input.gender,
      roomType: input.roomType,
      roomNumber: 'TBD',
      mahramGroup: input.mahramGroup.trim(),
      agentId: input.agentId || undefined,
      totalAmount,
      paidAmount: 0,
      status: 'PENDING_DP',
      kitDispatched: false,
      createdAt: todayIso,
    };

    const newDms: DmsRecord = {
      id: `dm-${Date.now()}`,
      tenantId: activeTenant.id,
      bookingId,
      jamaahName: newBooking.jamaahName,
      kloterCode: dep.kloterCode,
      departureDate: dep.departureDate,
      ktpStatus: 'REVIEW',
      kkStatus: 'REVIEW',
      passportNo: input.passportNo || '-',
      passportExpiry: input.passportNo ? input.passportExpiry : '',
      passportStatus: input.passportNo ? 'REVIEW' : 'MISSING',
      meningitisStatus: 'MISSING',
      mahramDocStatus: input.mahramGroup ? 'REVIEW' : 'VALID',
    };

    const directAgent = workspace.agents.find((a) => a.id === input.agentId);
    let commissionJournal: JournalEntry | null = null;
    let updatedAgents = workspace.agents;

    if (directAgent) {
      const directAmt = directAgent.directCommissionRate;
      const parentAgent = directAgent.parentAgentId
        ? workspace.agents.find((a) => a.id === directAgent.parentAgentId)
        : undefined;
      const overridingAmt = parentAgent
        ? Math.round(directAmt * ((parentAgent.overridingRatePct || 10) / 100))
        : 0;
      const totalCommission = directAmt + overridingAmt;

      updatedAgents = workspace.agents.map((a) => {
        if (a.id === directAgent.id) {
          return {
            ...a,
            jamaahCount: a.jamaahCount + 1,
            commissionEarned: a.commissionEarned + directAmt,
          };
        }
        if (parentAgent && a.id === parentAgent.id) {
          return {
            ...a,
            commissionEarned: a.commissionEarned + overridingAmt,
          };
        }
        return a;
      });

      commissionJournal = {
        id: `j-com-${Date.now()}`,
        tenantId: activeTenant.id,
        entryNo: `COM-${bookingNo}`,
        date: todayIso,
        refType: 'COMMISSION',
        kloterCode: dep.kloterCode,
        description: `Akrual Komisi Agen ${directAgent.name} a/n ${newBooking.jamaahName}`,
        lines: [
          {
            accountCode: '5-201',
            accountName: 'Beban Komisi Agen & Marketing',
            debit: totalCommission,
            credit: 0,
          },
          {
            accountCode: '2-102',
            accountName: 'Hutang Komisi Agen',
            debit: 0,
            credit: totalCommission,
          },
        ],
      };
    }

    updateActiveWorkspace((prev) => ({
      ...prev,
      bookings: [newBooking, ...prev.bookings],
      departures: prev.departures.map((d) => {
        if (d.id !== dep.id) return d;
        const filledSeats = d.filledSeats + 1;
        return {
          ...d,
          filledSeats,
          status: filledSeats >= d.totalSeats ? 'FULL' : d.status,
        };
      }),
      dmsRecords: [newDms, ...prev.dmsRecords],
      agents: updatedAgents,
      journals: commissionJournal ? [commissionJournal, ...prev.journals] : prev.journals,
    }));

    showFeedback(
      `Jamaah ${newBooking.jamaahName} terdaftar (${bookingNo}). Antrean DMS & Invoice diterbitkan.`
    );
  };

  const handleUpdateRooming = (
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
  };

  const handleCreatePackage = (input: {
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
    const newPkg: TravelPackage = {
      id: `pkg-${Date.now()}`,
      tenantId: activeTenant.id,
      ...input,
    };
    updateActiveWorkspace((prev) => ({
      ...prev,
      packages: [newPkg, ...prev.packages],
    }));
    showFeedback(`Paket ${newPkg.code} berhasil ditambahkan ke katalog.`);
  };

  // 4. Record Payment + Auto-Journal SAK ETAP
  const handleRecordPayment = (input: {
    bookingId: string;
    amount: number;
    method: PaymentMethod;
  }): PaymentRecord | null => {
    const targetBooking = workspace.bookings.find((b) => b.id === input.bookingId);
    if (!targetBooking) return null;

    const remaining = Math.max(0, targetBooking.totalAmount - targetBooking.paidAmount);
    const verifiedAmt = Math.min(input.amount, remaining);
    if (verifiedAmt <= 0) return null;

    const receiptNo = `KWT-2026-${String(81 + workspace.payments.length).padStart(3, '0')}`;
    const paymentRecord: PaymentRecord = {
      id: `p-${Date.now()}`,
      tenantId: activeTenant.id,
      bookingId: targetBooking.id,
      bookingNo: targetBooking.bookingNo,
      receiptNo,
      jamaahName: targetBooking.jamaahName,
      method: input.method,
      amount: verifiedAmt,
      date: todayIso,
      qrHash: `SIG-${activeTenant.code}-${Date.now().toString(36).toUpperCase().slice(-6)}`,
    };

    const cashAccount =
      input.method === 'CASH'
        ? { code: '1-101', name: 'Kas Tunai Kantor' }
        : { code: '1-102', name: 'Bank Operasional Syariah (BSI)' };

    const paymentJournal: JournalEntry = {
      id: `j-${Date.now()}`,
      tenantId: activeTenant.id,
      entryNo: `JRN-${Math.floor(100000 + Math.random() * 900000)}`,
      date: todayIso,
      refType: 'PAYMENT',
      kloterCode: targetBooking.kloterCode,
      description: `Penerimaan ${input.method} a/n ${targetBooking.jamaahName} (${receiptNo})`,
      lines: [
        {
          accountCode: cashAccount.code,
          accountName: cashAccount.name,
          debit: verifiedAmt,
          credit: 0,
        },
        {
          accountCode: '2-101',
          accountName: 'Uang Muka Jamaah (Liabilitas)',
          debit: 0,
          credit: verifiedAmt,
        },
      ],
    };

    updateActiveWorkspace((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) => {
        if (b.id !== targetBooking.id) return b;
        const newPaid = b.paidAmount + verifiedAmt;
        return {
          ...b,
          paidAmount: newPaid,
          status: newPaid >= b.totalAmount ? 'PAID' : 'INSTALLMENT',
        };
      }),
      payments: [paymentRecord, ...prev.payments],
      journals: [paymentJournal, ...prev.journals],
    }));

    showFeedback(
      `Pembayaran ${formatIDR(verifiedAmt)} (${receiptNo}) terverifikasi & terjurnal ke 2-101 Uang Muka Jamaah.`
    );
    return paymentRecord;
  };

  // 5. Record Manual Expense
  const handleRecordExpense = (input: {
    description: string;
    expenseAccountCode: string;
    paymentAccountCode: string;
    amount: number;
    kloterCode?: string;
  }) => {
    const expAcc = workspace.coa.find((c) => c.code === input.expenseAccountCode);
    const payAcc = workspace.coa.find((c) => c.code === input.paymentAccountCode);
    if (!expAcc || !payAcc) return;

    const expenseJournal: JournalEntry = {
      id: `j-exp-${Date.now()}`,
      tenantId: activeTenant.id,
      entryNo: `EXP-${Math.floor(10000 + Math.random() * 90000)}`,
      date: todayIso,
      refType: 'EXPENSE',
      kloterCode: input.kloterCode || undefined,
      description: input.description,
      lines: [
        {
          accountCode: expAcc.code,
          accountName: expAcc.name,
          debit: input.amount,
          credit: 0,
        },
        {
          accountCode: payAcc.code,
          accountName: payAcc.name,
          debit: 0,
          credit: input.amount,
        },
      ],
    };

    updateActiveWorkspace((prev) => ({
      ...prev,
      journals: [expenseJournal, ...prev.journals],
    }));
    showFeedback(`Jurnal pengeluaran ${formatIDR(input.amount)} berhasil diposting.`);
  };

  // 6. DMS Document Update
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
      dmsRecords: prev.dmsRecords.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
    }));
  };

  // 7. Inventory Assembly, Restock & Kit Handover
  const handleAssembleBundle = (quantity: number) => {
    const components = workspace.inventory.filter((i) => !i.isBundle);
    if (components.some((c) => c.qty < quantity)) return;

    updateActiveWorkspace((prev) => ({
      ...prev,
      inventory: prev.inventory.map((item) =>
        item.isBundle ? { ...item, qty: item.qty + quantity } : { ...item, qty: item.qty - quantity }
      ),
    }));
    showFeedback(`${quantity} set Paket Perlengkapan Siap Berangkat berhasil dirakit (Assembly).`);
  };

  const handleRestockItem = (itemId: string, addQty: number) => {
    updateActiveWorkspace((prev) => ({
      ...prev,
      inventory: prev.inventory.map((item) =>
        item.id === itemId ? { ...item, qty: item.qty + addQty } : item
      ),
    }));
    showFeedback(`Stok barang ditambah +${addQty} pcs.`);
  };

  const handleDispatchKitToJamaah = (bookingId: string) => {
    const bundle = workspace.inventory.find((i) => i.isBundle);
    if (!bundle || bundle.qty < 1) return;

    const targetBooking = workspace.bookings.find((b) => b.id === bookingId);
    updateActiveWorkspace((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) =>
        b.id === bookingId ? { ...b, kitDispatched: true } : b
      ),
      inventory: prev.inventory.map((i) =>
        i.id === bundle.id ? { ...i, qty: i.qty - 1 } : i
      ),
    }));
    if (targetBooking) {
      showFeedback(`1 set perlengkapan diserahkan kepada ${targetBooking.jamaahName}.`);
    }
  };

  // 8. Agency Commission Disbursement + Journal + ISO Incident
  const handleDisburseCommission = (agentId: string) => {
    const agent = workspace.agents.find((a) => a.id === agentId);
    if (!agent) return;
    const unpaid = Math.max(0, agent.commissionEarned - agent.commissionPaid);
    if (unpaid <= 0) return;

    const payoutJournal: JournalEntry = {
      id: `j-paycom-${Date.now()}`,
      tenantId: activeTenant.id,
      entryNo: `PAYCOM-${agent.code}`,
      date: todayIso,
      refType: 'COMMISSION',
      description: `Pencairan Komisi Agen ${agent.name} (${agent.code})`,
      lines: [
        {
          accountCode: '2-102',
          accountName: 'Hutang Komisi Agen',
          debit: unpaid,
          credit: 0,
        },
        {
          accountCode: '1-102',
          accountName: 'Bank Operasional Syariah (BSI)',
          debit: 0,
          credit: unpaid,
        },
      ],
    };

    updateActiveWorkspace((prev) => ({
      ...prev,
      agents: prev.agents.map((a) =>
        a.id === agentId ? { ...a, commissionPaid: a.commissionEarned } : a
      ),
      journals: [payoutJournal, ...prev.journals],
    }));

    showFeedback(
      `Komisi ${formatIDR(unpaid)} dicairkan kepada ${agent.name} dan dijurnal ke Buku Besar.`
    );
  };

  const handleCreateAgent = (input: {
    name: string;
    phone: string;
    parentAgentId?: string;
    directCommissionRate: number;
  }) => {
    const parent = input.parentAgentId
      ? workspace.agents.find((a) => a.id === input.parentAgentId)
      : undefined;

    const newAgent: Agent = {
      id: `ag-${Date.now()}`,
      tenantId: activeTenant.id,
      code: `AGN-${String(workspace.agents.length + 1).padStart(3, '0')}`,
      name: input.name,
      phone: input.phone,
      parentAgentId: parent?.id,
      parentAgentName: parent ? `${parent.name} (Overriding 10%)` : undefined,
      directCommissionRate: input.directCommissionRate,
      overridingRatePct: 10,
      jamaahCount: 0,
      commissionEarned: 0,
      commissionPaid: 0,
    };

    updateActiveWorkspace((prev) => ({
      ...prev,
      agents: [newAgent, ...prev.agents],
    }));
    showFeedback(`Agen ${newAgent.name} (${newAgent.code}) berhasil didaftarkan.`);
  };

  const handleUpdateIncidentStatus = (
    incidentId: string,
    status: IsoIncident['status'],
    resolutionNotes?: string
  ) => {
    updateActiveWorkspace((prev) => ({
      ...prev,
      isoIncidents: prev.isoIncidents.map((inc) =>
        inc.id === incidentId ? { ...inc, status, resolutionNotes } : inc
      ),
    }));
    showFeedback('Tiket SLA ISO 9001:2015 diperbarui.');
  };

  const handleCreateIncident = (input: {
    kloterCode: string;
    category: IncidentCategory;
    description: string;
    slaDeadline: string;
  }) => {
    const newInc: IsoIncident = {
      id: `iso-${Date.now()}`,
      tenantId: activeTenant.id,
      ticket: `SLA-2026-${String(20 + workspace.isoIncidents.length).padStart(3, '0')}`,
      kloterCode: input.kloterCode,
      category: input.category,
      description: input.description,
      slaDeadline: input.slaDeadline,
      status: 'OPEN',
    };
    updateActiveWorkspace((prev) => ({
      ...prev,
      isoIncidents: [newInc, ...prev.isoIncidents],
    }));
    showFeedback(`Tiket SLA ${newInc.ticket} diterbitkan.`);
  };

  // 9. Super-Admin Tenant Provisioning
  const handleCreateTenant = (input: {
    name: string;
    subdomain: string;
    ppiu: string;
    pihk: string;
    plan: PlanTier;
    primaryColor: string;
  }) => {
    const id = `t-${Date.now()}`;
    const initials = input.name
      .replace(/^PT\s+/i, '')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    const planLimits: Record<PlanTier, { maxJ: number; maxU: number }> = {
      LITE: { maxJ: 100, maxU: 5 },
      PRO: { maxJ: 350, maxU: 15 },
      ENTERPRISE: { maxJ: 1000, maxU: 50 },
    };

    const newTenant: Tenant = {
      id,
      code: initials || 'TR',
      name: input.name,
      subdomain: input.subdomain,
      ppiu: input.ppiu,
      pihk: input.pihk || 'Belum Terdaftar',
      plan: input.plan,
      maxJamaahPerMonth: planLimits[input.plan].maxJ,
      maxUsers: planLimits[input.plan].maxU,
      primaryColor: input.primaryColor,
      isActive: true,
    };

    const starterPkgId = `pkg-${id}`;
    const starterWorkspace: TenantWorkspaceData = {
      packages: [
        {
          id: starterPkgId,
          tenantId: id,
          code: 'UMR-9H-STD',
          name: 'Umrah Reguler 9 Hari Perdana',
          category: 'UMRAH',
          durationDays: 9,
          priceQuad: 27900000,
          priceTriple: 29900000,
          priceDouble: 32900000,
          hppEstimate: 22800000,
          hotelMakkah: 'Swissôtel Makkah (★5)',
          hotelMadinah: 'Pullman Zamzam Madinah (★5)',
        },
      ],
      departures: [
        {
          id: `dep-${id}`,
          tenantId: id,
          packageId: starterPkgId,
          kloterCode: `${initials}-2027-01A`,
          packageName: 'Umrah Reguler 9 Hari Perdana',
          airline: 'Saudia Airlines',
          departureDate: '2027-01-24',
          returnDate: '2027-02-01',
          totalSeats: 45,
          filledSeats: 0,
          estHppPerSeat: 22800000,
          status: 'OPEN',
        },
      ],
      bookings: [],
      payments: [],
      coa: STANDARD_TRAVEL_COA,
      journals: [],
      dmsRecords: [],
      inventory: [
        {
          id: `inv-${id}-1`,
          tenantId: id,
          sku: 'ITM-KPR24',
          name: 'Koper Hardcase 24 Inch',
          warehouse: 'Gudang Utama',
          qty: 50,
          minStock: 20,
          avgCost: 375000,
          isBundle: false,
        },
        {
          id: `inv-${id}-2`,
          tenantId: id,
          sku: 'BND-PKT01',
          name: 'Paket Perlengkapan Siap Berangkat',
          warehouse: 'Gudang Utama',
          qty: 10,
          minStock: 10,
          avgCost: 700000,
          isBundle: true,
        },
      ],
      agents: [],
      isoIncidents: [],
    };

    setState((prev) => ({
      tenants: [...prev.tenants, newTenant],
      workspaces: {
        ...prev.workspaces,
        [id]: starterWorkspace,
      },
    }));
    setSelectedTenantId(id);
    showFeedback(`Tenant ${newTenant.name} berhasil diprovisioning dengan Master COA SAK ETAP.`);
  };

  const handleUpdateTenantTheme = (tenantId: string, primaryColor: string) => {
    setState((prev) => ({
      ...prev,
      tenants: prev.tenants.map((t) =>
        t.id === tenantId ? { ...t, primaryColor } : t
      ),
    }));
  };

  const handleResetDemoData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({
      tenants: INITIAL_TENANTS,
      workspaces: INITIAL_WORKSPACE_DATA,
    });
    setSelectedTenantId('t1');
    setCurrentTab('dashboard');
    showFeedback('Seluruh data simulasi ERP dikembalikan ke kondisi awal.');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        tenants={state.tenants}
        selectedTenantId={activeTenant.id}
        onChangeTenant={(id) => {
          setSelectedTenantId(id);
          showFeedback(
            `Berpindah ke workspace ${state.tenants.find((t) => t.id === id)?.name || ''}`
          );
        }}
        activeRole={activeRole}
        onChangeRole={handleChangeRole}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenQuickRegister={() => setCurrentTab('bookings')}
      />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          activeTenant={activeTenant}
          activeRole={activeRole}
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          expiredPassportCount={expiredPassportCount}
          openIsoCount={openIsoCount}
          lowStockCount={lowStockCount}
          onResetDemoData={handleResetDemoData}
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

          {currentTab === 'dashboard' && (
            <DashboardView
              tenant={activeTenant}
              departures={workspace.departures}
              packages={workspace.packages}
              bookings={workspace.bookings}
              journals={workspace.journals}
              expiredPassportCount={expiredPassportCount}
              openIsoCount={openIsoCount}
              onDispatchDeparture={handleDispatchDeparture}
              onCreateDeparture={handleCreateDeparture}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'bookings' && (
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

          {currentTab === 'dms' && (
            <DmsView
              dmsRecords={workspace.dmsRecords}
              onUpdateDocument={handleUpdateDocument}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentsView
              tenant={activeTenant}
              bookings={workspace.bookings}
              payments={workspace.payments}
              onRecordPayment={handleRecordPayment}
            />
          )}

          {currentTab === 'accounting' && (
            <AccountingView
              tenant={activeTenant}
              coa={workspace.coa}
              journals={workspace.journals}
              departures={workspace.departures}
              onRecordExpense={handleRecordExpense}
            />
          )}

          {currentTab === 'inventory' && (
            <InventoryView
              tenant={activeTenant}
              inventory={workspace.inventory}
              bookings={workspace.bookings}
              onAssembleBundle={handleAssembleBundle}
              onRestockItem={handleRestockItem}
              onDispatchKitToJamaah={handleDispatchKitToJamaah}
            />
          )}

          {currentTab === 'agents' && (
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

          {currentTab === 'superadmin' && (
            <SuperAdminView
              tenants={state.tenants}
              activeTenantId={activeTenant.id}
              onSelectTenant={(id) => {
                setSelectedTenantId(id);
                setCurrentTab('dashboard');
              }}
              onCreateTenant={handleCreateTenant}
              onUpdateTenantTheme={handleUpdateTenantTheme}
            />
          )}
        </main>
      </div>
    </div>
  );
}
