import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency, formatDate } from '../lib/api';

interface Account {
  id: string;
  name: string;
}

interface ScheduledTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  frequency: string;
  nextRunAt: string;
  active: boolean;
}

export default function ScheduledTransfersPage() {
  const queryClient = useQueryClient();
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts/'),
  });
  const { data: schedulesData } = useQuery({
    queryKey: ['scheduled'],
    queryFn: () => api.get<{ data: ScheduledTransfer[] }>('/transactions/scheduled'),
  });

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('MONTHLY');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const accounts = accountsData?.data || [];
  const schedules = schedulesData?.data || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/transactions/scheduled', {
        fromAccountId,
        toAccountId,
        amount: parseFloat(amount),
        frequency,
      });
      setSuccess('Scheduled transfer created!');
      queryClient.invalidateQueries({ queryKey: ['scheduled'] });
      setAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule');
    }
  };

  const handleCancel = async (id: string) => {
    await api.delete(`/transactions/scheduled/${id}`);
    queryClient.invalidateQueries({ queryKey: ['scheduled'] });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Scheduled Transfers</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold">Create Schedule</h2>
          <div>
            <label className="label">From Account</label>
            <select className="input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} required>
              <option value="">Select</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">To Account</label>
            <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} required>
              <option value="">Select</option>
              {accounts.filter((a) => a.id !== fromAccountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Amount</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div>
            <label className="label">Frequency</label>
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Create Schedule</button>
        </form>

        <div className="card">
          <h2 className="font-semibold mb-4">Active Schedules</h2>
          {schedules.filter((s) => s.active).length === 0 ? (
            <p className="text-slate-500 text-sm">No scheduled transfers.</p>
          ) : (
            <div className="space-y-3">
              {schedules.filter((s) => s.active).map((s) => (
                <div key={s.id} className="p-3 border border-slate-100 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-medium">{formatCurrency(s.amount)} · {s.frequency}</p>
                    <p className="text-xs text-slate-500">Next: {formatDate(s.nextRunAt)}</p>
                  </div>
                  <button onClick={() => handleCancel(s.id)} className="text-red-600 text-sm hover:underline">Cancel</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
