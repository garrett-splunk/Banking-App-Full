import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatCurrency, formatDate } from '../lib/api';

interface LoanApplication {
  id: string;
  status: string;
  loanType: string;
  requestedAmount: number;
  termMonths: number;
  purpose: string;
  underwritingScore?: number;
  createdAt: string;
}

interface Loan {
  id: string;
  principal: number;
  interestRate: number;
  monthlyPayment: number;
  remainingBalance: number;
  termMonths: number;
  status: string;
}

export default function LoansPage() {
  const queryClient = useQueryClient();
  const { data: appsData } = useQuery({
    queryKey: ['loan-applications'],
    queryFn: () => api.get<{ data: LoanApplication[] }>('/loans/applications'),
  });
  const { data: loansData } = useQuery({
    queryKey: ['loans'],
    queryFn: () => api.get<{ data: Loan[] }>('/loans/'),
  });

  const [loanType, setLoanType] = useState('PERSONAL');
  const [requestedAmount, setRequestedAmount] = useState('10000');
  const [termMonths, setTermMonths] = useState('36');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/loans/applications', {
        loanType,
        requestedAmount: parseFloat(requestedAmount),
        termMonths: parseInt(termMonths),
        purpose,
      });
      setSuccess('Loan application submitted!');
      queryClient.invalidateQueries({ queryKey: ['loan-applications'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Application failed');
    }
  };

  const apps = appsData?.data || [];
  const loans = loansData?.data || [];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Loans</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {loans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {loans.map((l) => (
            <div key={l.id} className="card">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">{l.status}</span>
                <span className="text-sm">{l.interestRate}% APR</span>
              </div>
              <p className="text-2xl font-bold mt-2">{formatCurrency(l.remainingBalance)}</p>
              <p className="text-sm text-slate-500">Remaining balance</p>
              <p className="mt-3 text-sm">Monthly: {formatCurrency(l.monthlyPayment)} · {l.termMonths} months</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleApply} className="card space-y-4 mb-8 max-w-lg">
        <h2 className="font-semibold">Apply for a Loan</h2>
        <div>
          <label className="label">Loan Type</label>
          <select className="input" value={loanType} onChange={(e) => setLoanType(e.target.value)}>
            <option value="PERSONAL">Personal</option>
            <option value="AUTO">Auto</option>
            <option value="HOME">Home</option>
          </select>
        </div>
        <div>
          <label className="label">Amount</label>
          <input type="number" className="input" value={requestedAmount} onChange={(e) => setRequestedAmount(e.target.value)} required />
        </div>
        <div>
          <label className="label">Term (months)</label>
          <select className="input" value={termMonths} onChange={(e) => setTermMonths(e.target.value)}>
            <option value="12">12</option>
            <option value="24">24</option>
            <option value="36">36</option>
            <option value="60">60</option>
          </select>
        </div>
        <div>
          <label className="label">Purpose</label>
          <input type="text" className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
        </div>
        <button type="submit" className="btn-primary">Submit Application</button>
      </form>

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
                <th className="pb-2">Amount</th>
                <th className="pb-2">Score</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-3">{formatDate(a.createdAt)}</td>
                  <td>{a.loanType}</td>
                  <td>{formatCurrency(a.requestedAmount)}</td>
                  <td>{a.underwritingScore?.toFixed(0) || '-'}</td>
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
