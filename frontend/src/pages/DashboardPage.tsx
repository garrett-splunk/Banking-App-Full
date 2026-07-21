import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, formatCurrency, formatDate } from '../lib/api';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  accountNumber: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description?: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts/'),
  });
  const { data: txData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get<{ data: Transaction[] }>('/transactions/'),
  });

  const accounts = accountsData?.data || [];
  const transactions = txData?.data?.slice(0, 5) || [];
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-bank-600 to-bank-700 text-white">
          <p className="text-bank-100 text-sm">Total Balance</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Accounts</p>
          <p className="text-3xl font-bold mt-1">{accounts.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Quick Actions</p>
          <div className="flex gap-2 mt-2">
            <Link to="/transfer" className="btn-primary text-sm">Transfer</Link>
            <Link to="/bill-pay" className="btn-secondary text-sm">Bill Pay</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="font-semibold mb-4">Your Accounts</h2>
          {accounts.length === 0 ? (
            <p className="text-slate-500 text-sm">No accounts yet.</p>
          ) : (
            <div className="space-y-3">
              {accounts.map((a) => (
                <Link key={a.id} to={`/accounts/${a.id}`} className="block p-3 rounded-lg hover:bg-slate-50 border border-slate-100">
                  <div className="flex justify-between">
                    <span className="font-medium">{a.name}</span>
                    <span className="font-semibold">{formatCurrency(a.balance)}</span>
                  </div>
                  <p className="text-xs text-slate-500">{a.type} ····{a.accountNumber.slice(-4)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          {transactions.length === 0 ? (
            <p className="text-slate-500 text-sm">No recent transactions.</p>
          ) : (
            <div className="space-y-3">
              {transactions.map((t) => (
                <div key={t.id} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{t.description || t.type}</p>
                    <p className="text-xs text-slate-500">{formatDate(t.createdAt)}</p>
                  </div>
                  <span className={`font-semibold ${t.type === 'TRANSFER' ? 'text-red-600' : ''}`}>
                    {formatCurrency(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
