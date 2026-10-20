import React, { useState } from 'react';
import { UserRound, Phone, Cake, Pencil, Check, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export interface NomineeDetails {
  nomineeName: string;
  nomineePhone: string;
  nomineeAge: number | null;
}

interface NomineeCardProps {
  user: any;
  token: string;
  onSaved: (nominee: NomineeDetails) => void;
}

// Same rules as the backend (parseNominee in auth.controller.ts); every field is optional
const validate = (form: { nomineeName: string; nomineePhone: string; nomineeAge: string }) => {
  const errors: Record<string, string> = {};
  const name = form.nomineeName.trim();
  if (name && !/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(name)) {
    errors.nomineeName = 'Use letters, spaces, dots, hyphens and apostrophes only.';
  }
  if (form.nomineePhone && !/^\d{10}$/.test(form.nomineePhone)) {
    errors.nomineePhone = 'Phone number must be exactly 10 digits.';
  }
  if (form.nomineeAge && (Number(form.nomineeAge) < 1 || Number(form.nomineeAge) > 120)) {
    errors.nomineeAge = 'Age must be between 1 and 120.';
  }
  return errors;
};

const formFromUser = (user: any) => ({
  nomineeName: user?.nomineeName || '',
  nomineePhone: user?.nomineePhone || '',
  nomineeAge: user?.nomineeAge ? String(user.nomineeAge) : '',
});

export const NomineeCard: React.FC<NomineeCardProps> = ({ user, token, onSaved }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => formFromUser(user));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const startEditing = () => {
    setForm(formFromUser(user));
    setErrors({});
    setSaveError(null);
    setSavedMsg(null);
    setEditing(true);
  };

  const setField = (name: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const res = await api.updateNominee(
        {
          nomineeName: form.nomineeName.trim(),
          nomineePhone: form.nomineePhone,
          nomineeAge: form.nomineeAge ? Number(form.nomineeAge) : null,
        },
        token
      );
      if (res.status && res.data) {
        onSaved(res.data);
        setEditing(false);
        setSavedMsg(res.message || 'Nominee details saved.');
      } else {
        setSaveError(res.message || 'Could not save nominee details.');
      }
    } catch {
      setSaveError('Could not save nominee details. Please check your connection.');
    } finally {
      setSaving(false);
    }
  };

  const hasNominee = Boolean(user?.nomineeName || user?.nomineePhone || user?.nomineeAge);

  const fields: Array<{ name: keyof typeof form; label: string; icon: React.ElementType; display: string }> = [
    { name: 'nomineeName', label: 'Nominee Name', icon: UserRound, display: user?.nomineeName || '' },
    { name: 'nomineePhone', label: 'Nominee Phone Number', icon: Phone, display: user?.nomineePhone || '' },
    { name: 'nomineeAge', label: 'Nominee Age', icon: Cake, display: user?.nomineeAge ? `${user.nomineeAge} years` : '' },
  ];

  return (
    <section className="profile-card" aria-labelledby="profile-nominee-title">
      <div className="profile-card-head">
        <div>
          <h3 className="profile-card-title" id="profile-nominee-title">Nominee Details</h3>
          <p className="profile-card-subtitle">The person who will receive your benefits in case of an unforeseen event.</p>
        </div>
        {!editing && (
          <button type="button" className="profile-edit-btn" onClick={startEditing}>
            <Pencil size={14} aria-hidden="true" />
            <span>{hasNominee ? 'Edit' : 'Add nominee'}</span>
          </button>
        )}
      </div>

      {savedMsg && !editing && (
        <div className="kyc-alert is-success" role="status">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>{savedMsg}</span>
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSave} noValidate>
          <fieldset className="profile-nominee-form" disabled={saving}>
            <div className="kyc-field profile-nominee-name">
              <label htmlFor="nominee-name">Nominee Name</label>
              <input
                id="nominee-name"
                type="text"
                maxLength={100}
                autoComplete="off"
                placeholder="Nominee's full name"
                value={form.nomineeName}
                onChange={(e) => setField('nomineeName', e.target.value)}
                aria-invalid={Boolean(errors.nomineeName)}
                className={errors.nomineeName ? 'has-error' : ''}
              />
              {errors.nomineeName && <span className="kyc-field-error">{errors.nomineeName}</span>}
            </div>
            <div className="kyc-field">
              <label htmlFor="nominee-phone">Nominee Phone Number</label>
              <input
                id="nominee-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                placeholder="10 digit mobile"
                value={form.nomineePhone}
                onChange={(e) => setField('nomineePhone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                aria-invalid={Boolean(errors.nomineePhone)}
                className={errors.nomineePhone ? 'has-error' : ''}
              />
              {errors.nomineePhone && <span className="kyc-field-error">{errors.nomineePhone}</span>}
            </div>
            <div className="kyc-field">
              <label htmlFor="nominee-age">Nominee Age</label>
              <input
                id="nominee-age"
                type="text"
                inputMode="numeric"
                maxLength={3}
                autoComplete="off"
                placeholder="e.g. 45"
                value={form.nomineeAge}
                onChange={(e) => setField('nomineeAge', e.target.value.replace(/\D/g, '').slice(0, 3))}
                aria-invalid={Boolean(errors.nomineeAge)}
                className={errors.nomineeAge ? 'has-error' : ''}
              />
              {errors.nomineeAge && <span className="kyc-field-error">{errors.nomineeAge}</span>}
            </div>
          </fieldset>

          <p className="kyc-field-hint profile-nominee-hint">All nominee fields are optional. Clear a field to remove it.</p>

          {saveError && (
            <div className="kyc-alert is-error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="profile-form-actions">
            <button type="button" className="profile-secondary-btn" onClick={() => setEditing(false)} disabled={saving}>
              <X size={15} aria-hidden="true" />
              <span>Cancel</span>
            </button>
            <button type="submit" className="primary-btn profile-save-btn" disabled={saving}>
              {saving ? <Loader2 size={15} className="kyc-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
              <span>{saving ? 'Saving…' : 'Save changes'}</span>
            </button>
          </div>
        </form>
      ) : (
        <dl className="profile-info-list">
          {fields.map(({ name, label, icon: Icon, display }) => (
            <div key={name} className="profile-info-row">
              <dt>
                <Icon size={15} aria-hidden="true" />
                {label}
              </dt>
              <dd className={display ? '' : 'is-empty'}>{display || 'Not added'}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};
