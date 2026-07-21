import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency, formatDate } from '../lib/api';

export default function AdminDashboardPage() {
  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get<{
      pendingCardApplications: number;
      pendingLoanApplications: number;
      activeFeatureFlags: string[];
    }>('/admin/dashboard'),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-slate-500 text-sm">Pending Card Applications</p>
          <p className="text-4xl font-bold text-bank-600">{data?.pendingCardApplications ?? '...'}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Pending Loan Applications</p>
          <p className="text-4xl font-bold text-bank-600">{data?.pendingLoanApplications ?? '...'}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Active Feature Flags</p>
          <p className="text-4xl font-bold text-red-600">{data?.activeFeatureFlags?.length ?? 0}</p>
          {data?.activeFeatureFlags?.length ? (
            <p className="text-xs text-slate-500 mt-2">{data.activeFeatureFlags.join(', ')}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  updatedAt: string;
}

export function AdminFeatureFlagsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => api.get<{ data: FeatureFlag[] }>('/admin/feature-flags'),
  });

  const toggle = async (key: string, enabled: boolean) => {
    await api.patch(`/admin/feature-flags/${key}`, { enabled });
    queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const flags = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Feature Flags</h1>
      <p className="text-slate-500 mb-6">
        Toggle flags to simulate database insert failures. Users see a clear error; disable the flag to restore normal operation.
      </p>
      <p className="text-sm text-slate-400 mb-4">
        CLI: <code className="bg-slate-100 px-2 py-1 rounded">npm run flags -- enable fail_account_insert</code>
      </p>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <div key={flag.key} className="card flex justify-between items-center gap-4">
              <div>
                <p className="font-medium font-mono text-sm">{flag.key}</p>
                <p className="text-sm text-slate-500">{flag.description}</p>
              </div>
              <button
                onClick={() => toggle(flag.key, !flag.enabled)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  flag.enabled
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {flag.enabled ? 'ENABLED — Click to Disable' : 'Disabled — Click to Enable'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface CardApp {
  id: string;
  userId: string;
  status: string;
  requestedLimit: number;
  cardType: string;
  createdAt: string;
}

export function AdminCardApplicationsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-card-apps'],
    queryFn: () => api.get<{ data: CardApp[] }>('/admin/applications/cards'),
  });

  const decide = async (id: string, decision: 'APPROVED' | 'DENIED') => {
    await api.post(`/admin/applications/cards/${id}/decide`, { decision });
    queryClient.invalidateQueries({ queryKey: ['admin-card-apps'] });
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const apps = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Card Applications</h1>
      {apps.length === 0 ? (
        <p className="text-slate-500">No pending applications.</p>
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <div key={a.id} className="card flex justify-between items-center">
              <div>
                <p className="font-medium">{a.cardType} — {formatCurrency(a.requestedLimit)}</p>
                <p className="text-sm text-slate-500">User: {a.userId.slice(0, 8)}... · {formatDate(a.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide(a.id, 'APPROVED')} className="btn-primary text-sm">Approve</button>
                <button onClick={() => decide(a.id, 'DENIED')} className="btn-secondary text-sm text-red-600">Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface LoanApp {
  id: string;
  userId: string;
  loanType: string;
  requestedAmount: number;
  termMonths: number;
  purpose: string;
  underwritingScore?: number;
  createdAt: string;
}

export function AdminLoanApplicationsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-loan-apps'],
    queryFn: () => api.get<{ data: LoanApp[] }>('/admin/applications/loans'),
  });

  const decide = async (id: string, decision: 'APPROVED' | 'DENIED') => {
    await api.post(`/admin/applications/loans/${id}/decide`, { decision });
    queryClient.invalidateQueries({ queryKey: ['admin-loan-apps'] });
    queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
  };

  const apps = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Loan Applications</h1>
      {apps.length === 0 ? (
        <p className="text-slate-500">No pending applications.</p>
      ) : (
        <div className="space-y-4">
          {apps.map((a) => (
            <div key={a.id} className="card flex justify-between items-center">
              <div>
                <p className="font-medium">{a.loanType} — {formatCurrency(a.requestedAmount)} ({a.termMonths}mo)</p>
                <p className="text-sm text-slate-500">{a.purpose} · Score: {a.underwritingScore?.toFixed(0)}</p>
                <p className="text-xs text-slate-400">User: {a.userId.slice(0, 8)}... · {formatDate(a.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => decide(a.id, 'APPROVED')} className="btn-primary text-sm">Approve</button>
                <button onClick={() => decide(a.id, 'DENIED')} className="btn-secondary text-sm text-red-600">Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminUsersPage() {
  const { data } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<{ data: Array<{ userId: string; email: string; firstName: string; lastName: string; profileComplete: boolean }> }>('/admin/users'),
  });

  const users = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Users</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="pb-2">Email</th>
              <th className="pb-2">Name</th>
              <th className="pb-2">Profile</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId} className="border-b border-slate-50">
                <td className="py-3">{u.email}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.profileComplete ? 'Complete' : 'Incomplete'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
