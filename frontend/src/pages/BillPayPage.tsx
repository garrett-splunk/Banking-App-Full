import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency } from '../lib/api';

interface Account {
  id: string;
  name: string;
  balance: number;
}

interface Payee {
  id: string;
  name: string;
}

export default function BillPayPage() {
  const queryClient = useQueryClient();
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts/'),
  });
  const { data: payeesData } = useQuery({
    queryKey: ['payees'],
    queryFn: () => api.get<{ data: Payee[] }>('/transactions/payees'),
  });

  const [fromAccountId, setFromAccountId] = useState('');
  const [payeeName, setPayeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/transactions/bill-pay', {
        fromAccountId,
        payeeName,
        amount: parseFloat(amount),
      });
      setSuccess('Bill payment completed!');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const accounts = accountsData?.data || [];
  const payees = payeesData?.data || [];

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Bill Pay</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">From Account</label>
          <select className="input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} required>
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance)})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Payee</label>
          <input
            type="text"
            className="input"
            list="payees"
            value={payeeName}
            onChange={(e) => setPayeeName(e.target.value)}
            required
          />
          <datalist id="payees">
            {payees.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" min="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Processing...' : 'Pay Bill'}
        </button>
      </form>
    </div>
  );
}
