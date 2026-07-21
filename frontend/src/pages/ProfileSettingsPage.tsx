import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface Profile {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  employmentStatus: string;
  annualIncome: number;
  profileComplete: boolean;
}

export default function ProfileSettingsPage() {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<Profile>('/users/profile'),
  });

  const [form, setForm] = useState<Partial<Profile>>({});
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleChange = (field: keyof Profile, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.put('/users/profile', { ...profile, ...form });
      setSuccess('Profile updated!');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const p = { ...profile, ...form };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Profile Settings</h1>
      {profile?.profileComplete && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">Profile complete</div>
      )}
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">First Name</label>
            <input className="input" defaultValue={p.firstName} onChange={(e) => handleChange('firstName', e.target.value)} required />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" defaultValue={p.lastName} onChange={(e) => handleChange('lastName', e.target.value)} required />
          </div>
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" defaultValue={p.phone} onChange={(e) => handleChange('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Date of Birth</label>
          <input type="date" className="input" defaultValue={p.dateOfBirth} onChange={(e) => handleChange('dateOfBirth', e.target.value)} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" defaultValue={p.addressLine1} onChange={(e) => handleChange('addressLine1', e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">City</label>
            <input className="input" defaultValue={p.city} onChange={(e) => handleChange('city', e.target.value)} />
          </div>
          <div>
            <label className="label">State</label>
            <input className="input" defaultValue={p.state} onChange={(e) => handleChange('state', e.target.value)} />
          </div>
          <div>
            <label className="label">ZIP</label>
            <input className="input" defaultValue={p.zipCode} onChange={(e) => handleChange('zipCode', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Employment Status</label>
          <select className="input" defaultValue={p.employmentStatus} onChange={(e) => handleChange('employmentStatus', e.target.value)}>
            <option value="">Select</option>
            <option value="EMPLOYED">Employed</option>
            <option value="SELF_EMPLOYED">Self Employed</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
        <div>
          <label className="label">Annual Income</label>
          <input type="number" className="input" defaultValue={p.annualIncome} onChange={(e) => handleChange('annualIncome', parseFloat(e.target.value))} />
        </div>
        <button type="submit" className="btn-primary">Save Profile</button>
      </form>
    </div>
  );
}
