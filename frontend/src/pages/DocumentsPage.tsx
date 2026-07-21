import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, formatDate } from '../lib/api';

interface Document {
  id: string;
  type: string;
  fileName: string;
  status: string;
  uploadedAt: string;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<{ data: Document[] }>('/documents/'),
  });

  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState('GOVERNMENT_ID');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const docs = data?.data || [];

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);
      await api.post('/documents/upload', formData);
      setSuccess('Document uploaded! Verification typically completes within a few seconds.');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'VERIFIED') return 'bg-green-100 text-green-700';
    if (status === 'REJECTED') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Documents</h1>
      <p className="text-slate-500 mb-6">Upload KYC documents required for credit card and loan applications.</p>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      <form onSubmit={handleUpload} className="card space-y-4 mb-8 max-w-lg">
        <h2 className="font-semibold">Upload Document</h2>
        <div>
          <label className="label">Document Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="GOVERNMENT_ID">Government ID</option>
            <option value="PROOF_OF_INCOME">Proof of Income</option>
            <option value="PROOF_OF_ADDRESS">Proof of Address</option>
          </select>
        </div>
        <div>
          <label className="label">File (PDF, JPG, PNG — max 5MB)</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="input"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </div>
        <button type="submit" className="btn-primary" disabled={loading || !file}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>

      <div className="card">
        <h2 className="font-semibold mb-4">Your Documents</h2>
        {docs.length === 0 ? (
          <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">File</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Uploaded</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-b border-slate-50">
                  <td className="py-3">{d.fileName}</td>
                  <td>{d.type.replace(/_/g, ' ')}</td>
                  <td>{formatDate(d.uploadedAt)}</td>
                  <td><span className={`px-2 py-1 rounded text-xs ${statusColor(d.status)}`}>{d.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
