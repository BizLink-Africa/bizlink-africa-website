import { describe, expect, it } from 'vitest';
import { emailRates, landingPageConversionRate } from './marketing';

describe('emailRates', () => {
  it('computes delivery/open/click rates from raw counts', () => {
    const rates = emailRates({ sent_count: 1000, delivered_count: 950, opened_count: 380, clicked_count: 95 });
    expect(rates.deliveryRate).toBe(95);
    expect(rates.openRate).toBe(40);
    expect(rates.clickRate).toBe(10);
  });

  it('returns 0 for every rate when nothing was sent, never divides by zero', () => {
    const rates = emailRates({ sent_count: 0, delivered_count: 0, opened_count: 0, clicked_count: 0 });
    expect(rates.deliveryRate).toBe(0);
    expect(rates.openRate).toBe(0);
    expect(rates.clickRate).toBe(0);
  });

  it('rounds to one decimal place', () => {
    const rates = emailRates({ sent_count: 3, delivered_count: 3, opened_count: 1, clicked_count: 1 });
    expect(rates.openRate).toBe(33.3);
  });
});

describe('landingPageConversionRate', () => {
  it('computes form_submissions / visits as a percentage', () => {
    expect(landingPageConversionRate({ visits: 200, form_submissions: 25 })).toBe(12.5);
  });

  it('returns 0 when there have been no visits, never divides by zero', () => {
    expect(landingPageConversionRate({ visits: 0, form_submissions: 0 })).toBe(0);
  });
});
