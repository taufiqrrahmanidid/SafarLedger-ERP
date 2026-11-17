export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options?.headers || {}),
        },
    });

    if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
    }

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan pada server.');
    }
    return data as T;
}

export const api = {
    // DMS Update
    updateDms: (id: string, patch: Record<string, unknown>) =>
        apiRequest<any>(`/api/dms/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        }),

    // Paket & Kloter
    createPackage: (payload: Record<string, unknown>) =>
        apiRequest<any>('/api/packages', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    createDeparture: (payload: Record<string, unknown>) =>
        apiRequest<any>('/api/departures', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    dispatchDeparture: (id: string) =>
        apiRequest<any>(`/api/departures/${id}/dispatch`, {
            method: 'POST',
        }),

    // Rooming & Beban Keuangan
    updateRooming: (bookingId: string, roomNumber: string, mahramGroup: string) =>
        apiRequest<any>(`/api/bookings/${bookingId}/rooming`, {
            method: 'PATCH',
            body: JSON.stringify({ roomNumber, mahramGroup }),
        }),
    createExpense: (payload: Record<string, unknown>) =>
        apiRequest<any>('/api/expenses', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),

    // Gudang & Perlengkapan
    assembleBundle: (quantity: number) =>
        apiRequest<any[]>('/api/inventory/assemble', {
            method: 'POST',
            body: JSON.stringify({ quantity }),
        }),
    restockInventory: (id: string, addQty: number) =>
        apiRequest<any>(`/api/inventory/${id}/restock`, {
            method: 'POST',
            body: JSON.stringify({ addQty }),
        }),
    dispatchKit: (bookingId: string) =>
        apiRequest<any>(`/api/bookings/${bookingId}/dispatch-kit`, {
            method: 'POST',
        }),

    // Keagenan & ISO SLA
    createAgent: (payload: Record<string, unknown>) =>
        apiRequest<any>('/api/agents', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    disburseCommission: (agentId: string) =>
        apiRequest<any>(`/api/agents/${agentId}/disburse`, {
            method: 'POST',
        }),
    createIncident: (payload: Record<string, unknown>) =>
        apiRequest<any>('/api/incidents', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateIncident: (id: string, status: string, resolutionNotes?: string) =>
        apiRequest<any>(`/api/incidents/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status, resolutionNotes }),
        }),

    // Super Admin Tenant & Akun Sistem
    createTenant: (payload: Record<string, unknown>) =>
        apiRequest<any>('/api/superadmin/tenants', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateTenantTheme: (tenantId: string, primaryColor: string) =>
        apiRequest<any>(`/api/superadmin/tenants/${tenantId}/theme`, {
            method: 'PATCH',
            body: JSON.stringify({ primaryColor }),
        }),
    switchTenant: (tenantId: string) =>
        apiRequest<any>('/api/superadmin/switch-tenant', {
            method: 'POST',
            body: JSON.stringify({ tenantId }),
        }),
    listUsers: (tenantId?: string) =>
        apiRequest<any[]>(
            tenantId ? `/api/superadmin/users?tenantId=${encodeURIComponent(tenantId)}` : '/api/superadmin/users'
        ),
    createUser: (payload: {
        tenantId: string;
        name: string;
        email: string;
        password: string;
        role: string;
    }) =>
        apiRequest<any>('/api/superadmin/users', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateUser: (
        userId: string,
        payload: {
            name?: string;
            tenantId?: string;
            role?: string;
            isActive?: boolean;
            password?: string;
        }
    ) =>
        apiRequest<any>(`/api/superadmin/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    deleteUser: (userId: string) =>
        apiRequest<{ deletedId: string }>(`/api/superadmin/users/${userId}`, {
            method: 'DELETE',
        }),

    // Manajemen Akun Staf oleh Owner
    listTenantUsers: () => apiRequest<any[]>('/api/users'),
    createTenantUser: (payload: {
        name: string;
        email: string;
        password: string;
        role: string;
    }) =>
        apiRequest<any>('/api/users', {
            method: 'POST',
            body: JSON.stringify(payload),
        }),
    updateTenantUser: (
        userId: string,
        payload: {
            name?: string;
            role?: string;
            isActive?: boolean;
            password?: string;
        }
    ) =>
        apiRequest<any>(`/api/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
        }),
    deleteTenantUser: (userId: string) =>
        apiRequest<{ deletedId: string }>(`/api/users/${userId}`, {
            method: 'DELETE',
        }),
};