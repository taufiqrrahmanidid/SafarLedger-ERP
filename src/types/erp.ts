export type UserRole = 'OWNER' | 'OPS' | 'FINANCE' | 'AGENT' | 'SUPER_ADMIN';

export type ErpTab =
  | 'dashboard'
  | 'bookings'
  | 'dms'
  | 'payments'
  | 'accounting'
  | 'inventory'
  | 'agents'
  | 'users'
  | 'superadmin';

export type PlanTier = 'LITE' | 'PRO' | 'ENTERPRISE';

export interface Tenant {
  id: string;
  code: string;
  name: string;
  subdomain: string;
  customDomain?: string;
  ppiu: string;
  pihk: string;
  plan: PlanTier;
  maxJamaahPerMonth: number;
  maxUsers: number;
  primaryColor: string;
  isActive: boolean;
}

export type PackageCategory = 'UMRAH' | 'HAJI_PLUS' | 'FURODA' | 'WISATA_HALAL';

export interface TravelPackage {
  id: string;
  tenantId: string;
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
  imageUrl?: string;
}

export type DepartureStatus = 'OPEN' | 'FULL' | 'DEPARTED' | 'COMPLETED';

export interface Departure {
  id: string;
  tenantId: string;
  packageId: string;
  kloterCode: string;
  packageName: string;
  airline: string;
  departureDate: string;
  returnDate: string;
  totalSeats: number;
  filledSeats: number;
  estHppPerSeat: number;
  status: DepartureStatus;
}

export type RoomType = 'QUAD' | 'TRIPLE' | 'DOUBLE';
export type BookingStatus = 'PENDING_DP' | 'INSTALLMENT' | 'PAID' | 'CANCELLED';

export interface Booking {
  id: string;
  tenantId: string;
  bookingNo: string;
  departureId: string;
  kloterCode: string;
  jamaahName: string;
  nikMasked: string;
  phone: string;
  gender: 'L' | 'P';
  roomType: RoomType;
  roomNumber: string;
  mahramGroup: string;
  agentId?: string;
  totalAmount: number;
  paidAmount: number;
  status: BookingStatus;
  kitDispatched: boolean;
  createdAt: string;
}

export type PaymentMethod = 'BSI_VA' | 'XENDIT_VA' | 'MIDTRANS_VA' | 'BANK_TRANSFER' | 'CASH';

export interface PaymentRecord {
  id: string;
  tenantId: string;
  bookingId: string;
  bookingNo: string;
  receiptNo: string;
  jamaahName: string;
  method: PaymentMethod;
  amount: number;
  date: string;
  qrHash: string;
}

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface ChartOfAccount {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: 'DEBIT' | 'CREDIT';
  openingBalance: number;
}

export type JournalRefType = 'PAYMENT' | 'DEPARTURE_RECOGNITION' | 'COMMISSION' | 'EXPENSE' | 'OPENING';

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  tenantId: string;
  entryNo: string;
  date: string;
  refType: JournalRefType;
  kloterCode?: string;
  description: string;
  lines: JournalLine[];
}

export type DocValidationStatus = 'MISSING' | 'REVIEW' | 'VALID' | 'REJECTED';

export interface DmsRecord {
  id: string;
  tenantId: string;
  bookingId: string;
  jamaahName: string;
  kloterCode: string;
  departureDate: string;
  ktpStatus: DocValidationStatus;
  kkStatus: DocValidationStatus;
  passportNo: string;
  passportExpiry: string;
  passportStatus: DocValidationStatus;
  meningitisStatus: DocValidationStatus;
  mahramDocStatus: DocValidationStatus;
  hasKtpFile?: boolean;
  hasKkFile?: boolean;
  hasPassportFile?: boolean;
  hasMeningitisFile?: boolean;
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  warehouse: string;
  qty: number;
  minStock: number;
  avgCost: number;
  isBundle: boolean;
}

export interface Agent {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  phone: string;
  parentAgentId?: string;
  parentAgentName?: string;
  directCommissionRate: number;
  overridingRatePct: number;
  jamaahCount: number;
  commissionEarned: number;
  commissionPaid: number;
}

export type IncidentCategory = 'AKOMODASI' | 'KATERING' | 'TRANSPORTASI' | 'DOKUMEN';
export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export interface IsoIncident {
  id: string;
  tenantId: string;
  ticket: string;
  kloterCode: string;
  category: IncidentCategory;
  description: string;
  slaDeadline: string;
  status: IncidentStatus;
  resolutionNotes?: string;
}

export interface TenantWorkspaceData {
  packages: TravelPackage[];
  departures: Departure[];
  bookings: Booking[];
  payments: PaymentRecord[];
  coa: ChartOfAccount[];
  journals: JournalEntry[];
  dmsRecords: DmsRecord[];
  inventory: InventoryItem[];
  agents: Agent[];
  isoIncidents: IsoIncident[];
}

export interface SystemUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  tenant?: {
    id: string;
    code: string;
    name: string;
    subdomain: string;
  };
}