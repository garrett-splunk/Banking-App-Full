import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Account {
  id: string;
  name: string;
  balance: number;
}

export default function TransferPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<{ data: Account[] }>('/accounts/'),
  });
  const accounts = data?.data || [];

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await api.post('/transactions/transfer', {
        fromAccountId,
        toAccountId,
        amount: parseFloat(amount),
        description,
        mfaVerified: showMfa ? true : undefined,
      });
      setSuccess('Transfer completed successfully!');
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setAmount('');
      setDescription('');
      setShowMfa(false);
      setMfaCode('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      if (msg.includes('MFA')) {
        setShowMfa(true);
        setError('MFA verification required for transfers over $1,000');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Transfer Funds</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">From Account</label>
          <select className="input" value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)} required>
            <option value="">Select account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} (${a.balance.toFixed(2)})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">To Account</label>
          <select className="input" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} required>
            <option value="">Select account</option>
            {accounts.filter((a) => a.id !== fromAccountId).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" step="0.01" min="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label">Description (optional)</label>
          <input type="text" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {(showMfa || parseFloat(amount) > 1000) && user?.mfaEnabled && (
          <div>
            <label className="label">MFA Code (required for transfers over $1,000)</label>
            <input type="text" className="input" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-digit code" />
          </div>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Processing...' : 'Transfer'}
        </button>
      </form>
    </div>
  );
}
