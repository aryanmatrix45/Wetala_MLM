import React, { useEffect, useState } from 'react';
import { Coins, Landmark } from 'lucide-react';
import { api, type PaymentMethod } from '../services/api';

interface PaymentMethodPickerProps {
  /** Order total in rupees (bank / UPI payment) */
  amountInr: number;
  /** Order total in BV (BV Wallet payment); money and BV are never converted */
  amountBV: number;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

/**
 * Lets a member pay an order by bank / UPI (the existing payment-instructions flow) or from their
 * BV Wallet. Paying with BV costs the order's own BV value (e.g. a 1,250 BV package costs 1,250 BV),
 * and either way the order waits for Super Admin approval.
 */
export const PaymentMethodPicker: React.FC<PaymentMethodPickerProps> = ({ amountInr, amountBV, value, onChange, disabled }) => {
  const [availableBV, setAvailableBV] = useState<number | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);

  useEffect(() => {
    api
      .getBVWallet()
      .then((res: any) => {
        if (res?.status && res.data) {
          setAvailableBV(res.data.availableBV || 0);
          setIsFrozen(Boolean(res.data.isFrozen));
        } else {
          setAvailableBV(0);
        }
      })
      .catch(() => setAvailableBV(0));
  }, []);

  const bvPrice = amountBV;
  const canPayWithBV = availableBV !== null && !isFrozen && availableBV >= bvPrice && bvPrice > 0;

  // The BV option can't stay selected if the wallet no longer covers the order (e.g. the cart grew)
  useEffect(() => {
    if (value === 'BV_WALLET' && availableBV !== null && !canPayWithBV) onChange('BANK_TRANSFER');
  }, [value, availableBV, canPayWithBV, onChange]);

  const option = (method: PaymentMethod, icon: React.ReactNode, title: string, detail: React.ReactNode, optionDisabled = false) => {
    const selected = value === method;
    return (
      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          padding: '12px 14px',
          borderRadius: '12px',
          border: `1.5px solid ${selected ? '#2563eb' : '#e2e8f0'}`,
          background: selected ? '#eff6ff' : '#ffffff',
          cursor: disabled || optionDisabled ? 'not-allowed' : 'pointer',
          opacity: optionDisabled ? 0.6 : 1,
        }}
      >
        <input
          type="radio"
          name="payment-method"
          checked={selected}
          disabled={disabled || optionDisabled}
          onChange={() => onChange(method)}
          style={{ marginTop: '3px' }}
        />
        <span style={{ color: selected ? '#2563eb' : '#64748b', marginTop: '1px' }}>{icon}</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>{title}</span>
          <span style={{ display: 'block', color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{detail}</span>
        </span>
      </label>
    );
  };

  return (
    <div role="radiogroup" aria-label="Payment method" style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
      {option('BANK_TRANSFER', <Landmark size={18} />, `Pay ₹${amountInr.toLocaleString('en-IN')} by bank / UPI`, 'Super Admin sends payment details, then you submit your UTR')}
      {option(
        'BV_WALLET',
        <Coins size={18} />,
        `Pay ${bvPrice.toLocaleString('en-IN')} BV from BV Wallet`,
        availableBV === null ? (
          'Checking your BV Wallet…'
        ) : isFrozen ? (
          'Your BV Wallet is frozen'
        ) : canPayWithBV ? (
          `You have ${availableBV.toLocaleString('en-IN')} BV. BV is deducted now and returned if the order is rejected.`
        ) : (
          <span style={{ color: '#b45309' }}>
            You have {availableBV.toLocaleString('en-IN')} BV; {(bvPrice - availableBV).toLocaleString('en-IN')} BV more needed
          </span>
        ),
        !canPayWithBV
      )}
    </div>
  );
};

export default PaymentMethodPicker;
