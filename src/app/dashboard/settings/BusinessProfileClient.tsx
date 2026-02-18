'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useToast } from '@/components/ui/Toast';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface BusinessProfile {
  id: string;
  business_name: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  business_type: string | null;
  formation_date: string | null;
  ein: string | null;
  ein_set: boolean;
  ssn: string | null;
  ssn_set: boolean;
  bank_name: string | null;
  bank_routing: string | null;
  bank_routing_set: boolean;
  bank_account: string | null;
  bank_account_set: boolean;
  state_tax_id: string | null;
  state_tax_id_set: boolean;
  business_license: string | null;
  business_license_set: boolean;
}

type RevealKey = 'ein' | 'ssn' | 'bank_routing' | 'bank_account' | 'state_tax_id' | 'business_license';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Single-Member LLC',
  'Multi-Member LLC',
  'S Corporation',
  'C Corporation',
  'Partnership',
  'Nonprofit',
  'Other',
];

function SensitiveField({
  field, label, formValue, onChange, profile, revealed, revealedValues, onToggleReveal,
}: {
  field: RevealKey;
  label: string;
  formValue: string;
  onChange: (v: string) => void;
  profile: BusinessProfile;
  revealed: Record<RevealKey, boolean>;
  revealedValues: Partial<Record<RevealKey, string | null>>;
  onToggleReveal: (field: RevealKey) => void;
}) {
  const maskedValue = profile[field as keyof BusinessProfile] as string | null;
  const isSet = profile[`${field}_set` as keyof BusinessProfile] as boolean;
  const isRevealed = revealed[field];
  const displayValue = isRevealed
    ? (revealedValues[field] ?? 'Loading...')
    : (maskedValue ?? (isSet ? '--------' : 'Not set'));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-sm font-mono bg-gray-50 border rounded px-3 py-2 flex-1 ${isSet ? 'text-gray-600' : 'text-gray-400 italic'}`}>
          {displayValue}
        </span>
        {isSet && (
          <button
            type="button"
            onClick={() => onToggleReveal(field)}
            className="p-2 text-gray-500 hover:text-gray-700 border rounded-lg hover:bg-gray-50"
            title={isRevealed ? 'Hide' : 'Reveal'}
          >
            {isRevealed ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
          </button>
        )}
      </div>
      <input
        type="password"
        autoComplete="off"
        value={formValue}
        onChange={e => onChange(e.target.value)}
        placeholder={isSet ? 'Enter new value to update...' : 'Enter value...'}
        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
      />
    </div>
  );
}

export default function BusinessProfileClient() {
  const { showToast, ToastContainer } = useToast();
  const { data: profile, mutate } = useSWR<BusinessProfile>('/api/settings', fetcher);

  const [revealed, setRevealed] = useState<Record<RevealKey, boolean>>({
    ein: false, ssn: false, bank_routing: false, bank_account: false, state_tax_id: false, business_license: false,
  });
  const [revealedValues, setRevealedValues] = useState<Partial<Record<RevealKey, string | null>>>({});

  const [general, setGeneral] = useState({
    business_name: '', address_street: '', address_city: '', address_state: '', address_zip: '',
    phone: '', email: '', website: '', business_type: '', formation_date: '',
  });

  const [sensitive, setSensitive] = useState({ ein: '', ssn: '', state_tax_id: '', business_license: '' });
  const [bank, setBank] = useState({ bank_name: '', bank_routing: '', bank_account: '' });

  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingSensitive, setSavingSensitive] = useState(false);
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setGeneral({
      business_name: profile.business_name ?? '',
      address_street: profile.address_street ?? '',
      address_city: profile.address_city ?? '',
      address_state: profile.address_state ?? '',
      address_zip: profile.address_zip ?? '',
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      website: profile.website ?? '',
      business_type: profile.business_type ?? '',
      formation_date: profile.formation_date ?? '',
    });
    setBank(prev => ({ ...prev, bank_name: profile.bank_name ?? '' }));
  }, [profile]);

  async function toggleReveal(field: RevealKey) {
    const next = !revealed[field];
    setRevealed(prev => ({ ...prev, [field]: next }));

    if (next && !(field in revealedValues)) {
      try {
        const res = await fetch(`/api/settings?reveal=${field}`);
        const data = await res.json();
        setRevealedValues(prev => ({ ...prev, [field]: data[field] ?? null }));
      } catch {
        showToast('Failed to reveal value', 'error');
        setRevealed(prev => ({ ...prev, [field]: false }));
      }
    }
  }

  async function saveSection(payload: Record<string, unknown>, setSaving: (v: boolean) => void) {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to save');
      }
      showToast('Saved successfully', 'success');
      setRevealedValues({});
      setRevealed({ ein: false, ssn: false, bank_routing: false, bank_account: false, state_tax_id: false, business_license: false });
      mutate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error saving', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGeneral(e: React.FormEvent) {
    e.preventDefault();
    await saveSection(general, setSavingGeneral);
  }

  async function handleSaveSensitive(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string> = {};
    for (const [key, value] of Object.entries(sensitive)) {
      if (value.trim()) payload[key] = value.trim();
    }
    if (Object.keys(payload).length === 0) {
      showToast('Enter at least one value to save', 'info');
      return;
    }
    await saveSection(payload, setSavingSensitive);
    setSensitive({ ein: '', ssn: '', state_tax_id: '', business_license: '' });
  }

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, string | null> = { bank_name: bank.bank_name || null };
    if (bank.bank_routing.trim()) payload.bank_routing = bank.bank_routing.trim();
    if (bank.bank_account.trim()) payload.bank_account = bank.bank_account.trim();
    await saveSection(payload, setSavingBank);
    setBank(prev => ({ ...prev, bank_routing: '', bank_account: '' }));
  }

  if (!profile) {
    return <div className="text-gray-500 text-sm py-8 text-center">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <ToastContainer />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Business Profile</h1>
        <p className="text-gray-600 text-sm mt-1">
          Manage your business information. Sensitive fields are encrypted at rest.
        </p>
      </div>

      {/* General Information */}
      <section className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">General Information</h2>
          <p className="text-sm text-gray-500">Public-facing business details</p>
        </div>
        <form onSubmit={handleSaveGeneral} className="px-6 py-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                value={general.business_name}
                onChange={e => setGeneral(p => ({ ...p, business_name: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="NunezDev LLC"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
              <select
                value={general.business_type}
                onChange={e => setGeneral(p => ({ ...p, business_type: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              >
                <option value="">Select...</option>
                {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Formation Date</label>
              <input
                type="date"
                value={general.formation_date}
                onChange={e => setGeneral(p => ({ ...p, formation_date: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                value={general.address_street}
                onChange={e => setGeneral(p => ({ ...p, address_street: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="123 Main St"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={general.address_city}
                onChange={e => setGeneral(p => ({ ...p, address_city: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={general.address_state}
                  onChange={e => setGeneral(p => ({ ...p, address_state: e.target.value }))}
                  maxLength={2}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm uppercase"
                  placeholder="OK"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                <input
                  type="text"
                  value={general.address_zip}
                  onChange={e => setGeneral(p => ({ ...p, address_zip: e.target.value }))}
                  maxLength={10}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  placeholder="73101"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={general.phone}
                onChange={e => setGeneral(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="(405) 555-0100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
              <input
                type="email"
                value={general.email}
                onChange={e => setGeneral(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="hello@yourbusiness.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={general.website}
                onChange={e => setGeneral(p => ({ ...p, website: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                placeholder="https://nunezdev.com"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingGeneral}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {savingGeneral ? 'Saving...' : 'Save General Info'}
            </button>
          </div>
        </form>
      </section>

      {/* Sensitive Information */}
      <section className="bg-white rounded-xl border border-amber-200 shadow-sm">
        <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">Sensitive Information</h2>
          <p className="text-sm text-amber-700">
            Encrypted at rest. Values are masked by default — click the eye icon to reveal.
          </p>
        </div>
        <form onSubmit={handleSaveSensitive} className="px-6 py-6 space-y-6">
          <SensitiveField
            field="ein"
            label="EIN (Employer Identification Number)"
            formValue={sensitive.ein}
            onChange={v => setSensitive(p => ({ ...p, ein: v }))}
            profile={profile}
            revealed={revealed}
            revealedValues={revealedValues}
            onToggleReveal={toggleReveal}
          />
          <SensitiveField
            field="ssn"
            label="SSN (Social Security Number)"
            formValue={sensitive.ssn}
            onChange={v => setSensitive(p => ({ ...p, ssn: v }))}
            profile={profile}
            revealed={revealed}
            revealedValues={revealedValues}
            onToggleReveal={toggleReveal}
          />
          <SensitiveField
            field="state_tax_id"
            label="Oklahoma State Tax ID"
            formValue={sensitive.state_tax_id}
            onChange={v => setSensitive(p => ({ ...p, state_tax_id: v }))}
            profile={profile}
            revealed={revealed}
            revealedValues={revealedValues}
            onToggleReveal={toggleReveal}
          />
          <SensitiveField
            field="business_license"
            label="Business License Number"
            formValue={sensitive.business_license}
            onChange={v => setSensitive(p => ({ ...p, business_license: v }))}
            profile={profile}
            revealed={revealed}
            revealedValues={revealedValues}
            onToggleReveal={toggleReveal}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingSensitive}
              className="px-5 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {savingSensitive ? 'Saving...' : 'Save Sensitive Info'}
            </button>
          </div>
        </form>
      </section>

      {/* Bank Information */}
      <section className="bg-white rounded-xl border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Bank Information</h2>
          <p className="text-sm text-gray-500">Routing and account numbers are encrypted at rest.</p>
        </div>
        <form onSubmit={handleSaveBank} className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={bank.bank_name}
              onChange={e => setBank(p => ({ ...p, bank_name: e.target.value }))}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
              placeholder="Chase, Bank of Oklahoma, etc."
            />
          </div>

          <SensitiveField
            field="bank_routing"
            label="Routing Number"
            formValue={bank.bank_routing}
            onChange={v => setBank(p => ({ ...p, bank_routing: v }))}
            profile={profile}
            revealed={revealed}
            revealedValues={revealedValues}
            onToggleReveal={toggleReveal}
          />
          <SensitiveField
            field="bank_account"
            label="Account Number"
            formValue={bank.bank_account}
            onChange={v => setBank(p => ({ ...p, bank_account: v }))}
            profile={profile}
            revealed={revealed}
            revealedValues={revealedValues}
            onToggleReveal={toggleReveal}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingBank}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {savingBank ? 'Saving...' : 'Save Bank Info'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
