import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency, formatDate } from '../lib/api';

interface CardApplication {
  id: string;
  status: string;
  requestedLimit: number;
  cardType: string;
  createdAt: string;
}

interface CreditCard {
  id: string;
  maskedPan: string;
  creditLimit: number;
  availableCredit: number;
  status: string;
  expiryDate: string;
}

export default function CardsPage() {
  const queryClient = useQueryClient();
  const { data: appsData } = useQuery({
    queryKey: ['card-applications'],
    queryFn: () => api.get<{ data: CardApplication[] }>('/cards/applications'),
  });
  const { data: cardsData } = useQuery({
    queryKey: ['cards'],
    queryFn: () => api.get<{ data: CreditCard[] }>('/cards/'),
  });

  const [requestedLimit, setRequestedLimit] = useState('5000');
  const [cardType, setCardType] = useState('STANDARD');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/cards/applications', {
        requestedLimit: parseFloat(requestedLimit),
        cardType,
      });
      setSuccess('Application submitted!');
      queryClient.invalidateQueries({ queryKey: ['card-applications'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed');
    }
  };

  const apps = appsData?.data || [];
  const cards = cardsData?.data || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Credit Cards</h1>
        <Link to="/cards/apply" className="btn-primary">Apply for Card</Link>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {cards.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {cards.map((c) => (
            <div key={c.id} className="card bg-gradient-to-br from-slate-800 to-slate-900 text-white">
              <p className="text-slate-300 text-sm">{c.status}</p>
              <p className="text-xl font-mono my-4 tracking-wider">{c.maskedPan}</p>
              <div className="flex justify-between text-sm">
                <span>Limit: {formatCurrency(c.creditLimit)}</span>
                <span>Available: {formatCurrency(c.availableCredit)}</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">Exp: {c.expiryDate}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card mb-8">
        <h2 className="font-semibold mb-4">Quick Apply</h2>
        <form onSubmit={handleApply} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="label">Card Type</label>
            <select className="input" value={cardType} onChange={(e) => setCardType(e.target.value)}>
              <option value="STANDARD">Standard</option>
              <option value="REWARDS">Rewards</option>
              <option value="PREMIUM">Premium</option>
            </select>
          </div>
          <div>
            <label className="label">Requested Limit</label>
            <input type="number" className="input" value={requestedLimit} onChange={(e) => setRequestedLimit(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">Submit Application</button>
        </form>
        <p className="text-xs text-slate-500 mt-2">Complete your profile and upload required documents before applying.</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-4">Applications</h2>
        {apps.length === 0 ? (
          <p className="text-slate-500 text-sm">No applications yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Limit</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-3">{formatDate(a.createdAt)}</td>
                  <td>{a.cardType}</td>
                  <td>{formatCurrency(a.requestedLimit)}</td>
                  <td><span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
