import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, formatCurrency, formatDate } from '../lib/api';

export default function AccountDetailPage() {
  const { id } = useParams();
  const { data: account } = useQuery({
    queryKey: ['account', id],
    queryFn: () => api.get<{ id: string; name: string; type: string; balance: number; accountNumber: string }>(`/accounts/${id}`),
  });
  const { data: txData } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api.get<{ data: Array<{ id: string; fromAccountId?: string; toAccountId?: string; amount: number; type: string; description?: string; createdAt: string }> }>('/transactions/'),
  });

  const transactions = txData?.data?.filter((t) => t.fromAccountId === id || t.toAccountId === id) || [];

  if (!account) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{account.name}</h1>
      <p className="text-slate-500 mb-6">{account.type} · Account #{account.accountNumber}</p>
      <div className="card mb-6">
        <p className="text-sm text-slate-500">Available Balance</p>
        <p className="text-4xl font-bold text-bank-600">{formatCurrency(account.balance)}</p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <p className="text-slate-500 text-sm">No transactions for this account.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Type</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50">
                  <td className="py-3">{formatDate(t.createdAt)}</td>
                  <td>{t.description || '-'}</td>
                  <td>{t.type}</td>
                  <td className="text-right font-medium">{formatCurrency(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
