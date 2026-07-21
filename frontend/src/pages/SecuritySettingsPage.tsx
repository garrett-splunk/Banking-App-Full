import { useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export default function SecuritySettingsPage() {
  const { user, refreshUser } = useAuth();
  const [qrCode, setQrCode] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleEnroll = async () => {
    setError('');
    try {
      const result = await api.post<{ qrCode: string }>('/auth/mfa/enroll');
      setQrCode(result.qrCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/mfa/verify', { code });
      setSuccess('MFA enabled successfully!');
      setQrCode('');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/mfa/disable', { code, password });
      setSuccess('MFA disabled.');
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable MFA');
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Security Settings</h1>
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="card">
        <h2 className="font-semibold mb-2">Two-Factor Authentication (TOTP)</h2>
        <p className="text-sm text-slate-500 mb-4">
          Status: {user?.mfaEnabled ? (
            <span className="text-green-600 font-medium">Enabled</span>
          ) : (
            <span className="text-yellow-600 font-medium">Disabled</span>
          )}
        </p>

        {!user?.mfaEnabled ? (
          <>
            {!qrCode ? (
              <button onClick={handleEnroll} className="btn-primary">Enable MFA</button>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <p className="text-sm">Scan this QR code with your authenticator app:</p>
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 border rounded" />
                <div>
                  <label className="label">Enter verification code</label>
                  <input type="text" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" required />
                </div>
                <button type="submit" className="btn-primary">Verify & Enable</button>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={handleDisable} className="space-y-4">
            <div>
              <label className="label">MFA Code</label>
              <input type="text" className="input" value={code} onChange={(e) => setCode(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn-secondary text-red-600 border-red-200">Disable MFA</button>
          </form>
        )}
      </div>
    </div>
  );
}
