import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, formatCurrency } from '../lib/api';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  accountNumber: string;
  status: string;
}

export default function AccountsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts/'),
  });

  const accounts = data?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Accounts</h1>
      {isError ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error instanceof Error ? error.message : 'Failed to load accounts'}
        </div>
      ) : isLoading ? (
        <p>Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="text-slate-500">No accounts yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((a) => (
            <Link key={a.id} to={`/accounts/${a.id}`} className="card hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{a.name}</h3>
                  <p className="text-sm text-slate-500">{a.type}</p>
                  <p className="text-xs text-slate-400 mt-1">Account #{a.accountNumber}</p>
                </div>
                <p className="text-2xl font-bold text-bank-600">{formatCurrency(a.balance)}</p>
              </div>
              <span className="inline-block mt-3 text-xs px-2 py-1 bg-green-100 text-green-700 rounded">{a.status}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
