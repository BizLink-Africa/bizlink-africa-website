'use client';

import Image from 'next/image';
import { Mail, Phone, MapPin, Send, MessageCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useRef, useState } from 'react';
import { COMPANY } from '@/data/website';
import {
  REQUESTED_SOLUTIONS,
  PREFERRED_CONTACT_METHODS,
  MERCHANT_SOLUTION_VALUE,
  MERCHANT_BUSINESS_REGISTRATION_STATUSES,
  MERCHANT_BUSINESS_TYPES,
  MERCHANT_MONTHLY_VOLUME_RANGES,
  MERCHANT_COLLECTION_METHODS,
  MERCHANT_GOLIVE_TIMELINES,
} from '@/data/inquiries';
import { inquirySchema, firstFieldErrors } from '@/lib/validation/inquiry';
import posthog from 'posthog-js';

// Metadata must be in a server component — using a separate export via generateMetadata isn't possible in a client component.
// For client-side form interaction we use 'use client', and set metadata via a separate metadata.ts in the route folder.

const initialForm = {
  fullName: '',
  businessName: '',
  businessType: '',
  location: '',
  phone: '',
  email: '',
  requestedSolution: [] as string[],
  preferredContactMethod: '',
  message: '',
  consentGiven: false,
  website: '', // honeypot — must stay empty; hidden from real users
  merchantBusinessRegistrationStatus: '',
  merchantBusinessType: '',
  merchantMonthlyVolumeRange: '',
  merchantCurrentCollectionMethod: '',
  merchantBusinessLocationsCount: '',
  merchantGoLiveTimeline: '',
  merchantAccuracyConfirmed: false,
};

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submittingRef = useRef(false);

  const isMerchantSelected = form.requestedSolution.includes(MERCHANT_SOLUTION_VALUE);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
  };

  const handleSolutionToggle = (value: string) => {
    setForm((prev) => ({
      ...prev,
      requestedSolution: prev.requestedSolution.includes(value)
        ? prev.requestedSolution.filter((v) => v !== value)
        : [...prev.requestedSolution, value],
    }));
    setFieldErrors((prev) => (prev.requestedSolution ? { ...prev, requestedSolution: '' } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Guards a fast double-click: React state updates are async, so
    // `submitting` alone can't stop a second submit fired before the first
    // re-render lands. This ref check is synchronous.
    if (submittingRef.current) return;

    const payload = {
      ...form,
      merchantBusinessLocationsCount:
        form.merchantBusinessLocationsCount === '' ? undefined : Number(form.merchantBusinessLocationsCount),
    };

    const parsed = inquirySchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      setErrorMessage(parsed.error.issues[0]?.message ?? 'Please check the form and try again.');
      return;
    }
    setFieldErrors({});

    submittingRef.current = true;
    setSubmitting(true);
    let result: { success: boolean; message: string };
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const distinctId = posthog.get_distinct_id();
      if (distinctId) headers['X-POSTHOG-DISTINCT-ID'] = distinctId;

      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers,
        body: JSON.stringify(parsed.data),
      });
      result = await response.json();
    } catch {
      result = { success: false, message: 'Something went wrong submitting your inquiry. Please try again.' };
    }
    submittingRef.current = false;
    setSubmitting(false);

    if (!result.success) {
      posthog.capture('inquiry_submission_failed', {
        solutions_requested: form.requestedSolution,
        preferred_contact_method: form.preferredContactMethod,
      });
      setErrorMessage(result.message);
      return;
    }

    posthog.capture('inquiry_form_submitted', {
      solutions_requested: form.requestedSolution,
      preferred_contact_method: form.preferredContactMethod,
      has_message: form.message.length > 0,
      is_merchant_payment_infrastructure: isMerchantSelected,
    });

    setForm(initialForm);
    setSubmitted(true);
  };

  const inputClass =
    'w-full bg-transparent border-b border-[#bfc9c4] py-3 focus:border-[#00342b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 text-[#1b1c1c] text-sm placeholder:text-[#aeb1b1] transition-colors';

  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

  const errorClass = 'text-xs text-red-700 mt-1.5';

  const linkFocusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm';

  return (
    <>
      {/* ── HERO ── */}
      <section className="pt-20 pb-12 px-6 md:px-12 max-w-[1280px] mx-auto">
        <div className="max-w-3xl">
          <span className="text-xs font-semibold text-[#00342b] uppercase tracking-widest mb-4 block">Get In Touch</span>
          <h1 className="font-[Geist,sans-serif] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-[#1b1c1c] mb-5">
            Let&apos;s Build Together
          </h1>
          <p className="text-lg leading-relaxed text-[#3f4945] max-w-xl">
            Submit your business details and our team will contact you.
          </p>
        </div>
      </section>

      {/* ── BENTO GRID ── */}
      <section className="pb-24 px-6 md:px-12 max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── FORM (left 7) ── */}
          <div className="lg:col-span-7 bg-white border border-[#bfc9c4] p-8 md:p-12">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <div className="w-16 h-16 bg-[#afefdd] flex items-center justify-center mb-5">
                  <Send size={28} className="text-[#00342b]" />
                </div>
                <h2 className="font-[Geist,sans-serif] font-semibold text-2xl text-[#00342b] mb-3">Application Received</h2>
                <p className="text-[#3f4945] max-w-sm leading-relaxed">
                  Thank you for reaching out. Our team will review your application and contact you shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8 relative">
                {/* Honeypot — hidden from real users; a filled value flags a bot. */}
                <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
                  <label htmlFor="website">Leave this field empty</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={handleChange}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass} htmlFor="fullName">Full Name</label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required
                      placeholder="Balekele Masasi"
                      value={form.fullName}
                      onChange={handleChange}
                      className={inputClass}
                    />
                    {fieldErrors.fullName && <p className={errorClass}>{fieldErrors.fullName}</p>}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="businessName">Business / Company Name</label>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      required
                      placeholder="BizLink Africa Limited"
                      value={form.businessName}
                      onChange={handleChange}
                      className={inputClass}
                    />
                    {fieldErrors.businessName && <p className={errorClass}>{fieldErrors.businessName}</p>}
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="businessType">Business Type / Service Offered</label>
                  <input
                    id="businessType"
                    name="businessType"
                    type="text"
                    required
                    placeholder="e.g. Online Retail, Event Planning, Delivery Service"
                    value={form.businessType}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  {fieldErrors.businessType && <p className={errorClass}>{fieldErrors.businessType}</p>}
                </div>

                <div>
                  <label className={labelClass} htmlFor="location">Physical Location</label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    required
                    placeholder="e.g. Kinondoni, Dar es Salaam"
                    value={form.location}
                    onChange={handleChange}
                    className={inputClass}
                  />
                  {fieldErrors.location && <p className={errorClass}>{fieldErrors.location}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass} htmlFor="phone">Phone / WhatsApp Number</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      placeholder="+255 7XX XXX XXX"
                      value={form.phone}
                      onChange={handleChange}
                      className={inputClass}
                    />
                    {fieldErrors.phone && <p className={errorClass}>{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="email">Email Address</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      placeholder="you@business.com"
                      value={form.email}
                      onChange={handleChange}
                      className={inputClass}
                    />
                    {fieldErrors.email && <p className={errorClass}>{fieldErrors.email}</p>}
                  </div>
                </div>

                {/* Service Requirements */}
                <div className="border-t border-[#bfc9c4] pt-8">
                  <p className={labelClass}>What do you need? (select all that apply)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    {REQUESTED_SOLUTIONS.map((solution) => (
                      <label key={solution.value} className="flex items-center gap-3 py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.requestedSolution.includes(solution.value)}
                          onChange={() => handleSolutionToggle(solution.value)}
                          className="w-5 h-5 shrink-0 accent-[#00342b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm"
                        />
                        <span className="text-sm text-[#1b1c1c]">{solution.label}</span>
                      </label>
                    ))}
                  </div>
                  {fieldErrors.requestedSolution && <p className={errorClass}>{fieldErrors.requestedSolution}</p>}
                </div>

                {isMerchantSelected && (
                  <div className="border-t border-[#bfc9c4] pt-8">
                    <p className="text-xs font-semibold text-[#00342b] uppercase tracking-wider mb-1">
                      Merchant Payment Infrastructure — Preliminary Details
                    </p>
                    <p className="text-xs text-[#707975] leading-relaxed mb-5">
                      Preliminary business information only. Bank account numbers, mobile-wallet numbers, and KYC documents are never collected here — those are handled later through a secure, protected onboarding process.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={labelClass} htmlFor="merchantBusinessRegistrationStatus">Business Registration Status</label>
                        <select
                          id="merchantBusinessRegistrationStatus"
                          name="merchantBusinessRegistrationStatus"
                          value={form.merchantBusinessRegistrationStatus}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select an option</option>
                          {MERCHANT_BUSINESS_REGISTRATION_STATUSES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {fieldErrors.merchantBusinessRegistrationStatus && <p className={errorClass}>{fieldErrors.merchantBusinessRegistrationStatus}</p>}
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="merchantBusinessType">Business Type</label>
                        <select
                          id="merchantBusinessType"
                          name="merchantBusinessType"
                          value={form.merchantBusinessType}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select an option</option>
                          {MERCHANT_BUSINESS_TYPES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {fieldErrors.merchantBusinessType && <p className={errorClass}>{fieldErrors.merchantBusinessType}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <label className={labelClass} htmlFor="merchantMonthlyVolumeRange">Estimated Monthly Transaction Volume</label>
                        <select
                          id="merchantMonthlyVolumeRange"
                          name="merchantMonthlyVolumeRange"
                          value={form.merchantMonthlyVolumeRange}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select a range</option>
                          {MERCHANT_MONTHLY_VOLUME_RANGES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {fieldErrors.merchantMonthlyVolumeRange && <p className={errorClass}>{fieldErrors.merchantMonthlyVolumeRange}</p>}
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="merchantCurrentCollectionMethod">Current Payment Collection Method</label>
                        <select
                          id="merchantCurrentCollectionMethod"
                          name="merchantCurrentCollectionMethod"
                          value={form.merchantCurrentCollectionMethod}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select an option</option>
                          {MERCHANT_COLLECTION_METHODS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {fieldErrors.merchantCurrentCollectionMethod && <p className={errorClass}>{fieldErrors.merchantCurrentCollectionMethod}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <label className={labelClass} htmlFor="merchantBusinessLocationsCount">Number of Business Locations / Branches</label>
                        <input
                          id="merchantBusinessLocationsCount"
                          name="merchantBusinessLocationsCount"
                          type="number"
                          min={1}
                          step={1}
                          placeholder="e.g. 1"
                          value={form.merchantBusinessLocationsCount}
                          onChange={handleChange}
                          className={inputClass}
                        />
                        {fieldErrors.merchantBusinessLocationsCount && <p className={errorClass}>{fieldErrors.merchantBusinessLocationsCount}</p>}
                      </div>
                      <div>
                        <label className={labelClass} htmlFor="merchantGoLiveTimeline">Expected Go-Live Timeline</label>
                        <select
                          id="merchantGoLiveTimeline"
                          name="merchantGoLiveTimeline"
                          value={form.merchantGoLiveTimeline}
                          onChange={handleChange}
                          className={inputClass}
                        >
                          <option value="">Select an option</option>
                          {MERCHANT_GOLIVE_TIMELINES.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                        {fieldErrors.merchantGoLiveTimeline && <p className={errorClass}>{fieldErrors.merchantGoLiveTimeline}</p>}
                      </div>
                    </div>

                    <label className="flex items-start gap-3 py-1 mt-6 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.merchantAccuracyConfirmed}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, merchantAccuracyConfirmed: e.target.checked }));
                          setFieldErrors((prev) => (prev.merchantAccuracyConfirmed ? { ...prev, merchantAccuracyConfirmed: '' } : prev));
                        }}
                        className="w-5 h-5 shrink-0 accent-[#00342b] mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm"
                      />
                      <span className="text-sm text-[#3f4945]">
                        I confirm that the information submitted is accurate and I understand that merchant activation is subject to business verification, KYC approval and applicable service terms.
                      </span>
                    </label>
                    {fieldErrors.merchantAccuracyConfirmed && <p className={errorClass}>{fieldErrors.merchantAccuracyConfirmed}</p>}

                    <div className="mt-6 flex items-start gap-2 bg-[#afefdd]/10 border border-[#afefdd] p-4">
                      <ShieldCheck size={16} className="text-[#00342b] mt-0.5 shrink-0" />
                      <p className="text-xs text-[#3f4945] leading-relaxed">
                        Final KYC, till/payment-account activation and settlement are subject to review and approval by the approved payment infrastructure partner and are not guaranteed.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelClass} htmlFor="preferredContactMethod">Preferred Contact Method</label>
                  <select
                    id="preferredContactMethod"
                    name="preferredContactMethod"
                    value={form.preferredContactMethod}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">Select an option</option>
                    {PREFERRED_CONTACT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass} htmlFor="message">Message / Description</label>
                  <textarea
                    id="message"
                    name="message"
                    rows={4}
                    placeholder="Tell us more about your business needs or any questions you have..."
                    value={form.message}
                    onChange={handleChange}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div>
                  <label className="flex items-start gap-3 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.consentGiven}
                      onChange={(e) => {
                        setForm((prev) => ({ ...prev, consentGiven: e.target.checked }));
                        setFieldErrors((prev) => (prev.consentGiven ? { ...prev, consentGiven: '' } : prev));
                      }}
                      className="w-5 h-5 shrink-0 accent-[#00342b] mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm"
                    />
                    <span className="text-sm text-[#3f4945]">
                      I agree that BizLink Africa may contact me about this inquiry.
                    </span>
                  </label>
                  {fieldErrors.consentGiven && <p className={errorClass}>{fieldErrors.consentGiven}</p>}
                </div>

                {errorMessage && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">
                    {errorMessage}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="group flex items-center justify-between w-full md:w-auto md:min-w-[240px] bg-[#00342b] text-white py-4 px-8 text-sm font-medium tracking-wide hover:bg-[#004d40] transition-colors active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2"
                >
                  <span>{submitting ? 'Submitting...' : 'Submit Application'}</span>
                  {submitting ? (
                    <Loader2 size={16} className="ml-4 animate-spin" />
                  ) : (
                    <Send size={16} className="ml-4 group-hover:translate-x-1 transition-transform" />
                  )}
                </button>
              </form>
            )}
          </div>

          {/* ── SIDEBAR (right 5) ── */}
          <div className="lg:col-span-5 flex flex-col gap-6 h-full">
            {/* Contact info */}
            <div className="border border-[#bfc9c4] bg-[#f5f3f3] p-8 flex flex-col gap-6">
              <p className="text-xs font-semibold text-[#00342b] uppercase tracking-widest">Connect With Us</p>
              <div className="flex flex-col gap-5">
                <a href={`mailto:${COMPANY.emailGeneral}`} className={`flex items-start gap-3 group ${linkFocusClass}`}>
                  <Mail size={16} className="text-[#00342b] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#707975] mb-0.5">Business Email</p>
                    <p className="text-sm text-[#1b1c1c] group-hover:text-[#00342b] transition-colors">{COMPANY.emailGeneral}</p>
                  </div>
                </a>
                <a href={`mailto:${COMPANY.emailSupport}`} className={`flex items-start gap-3 group ${linkFocusClass}`}>
                  <Mail size={16} className="text-[#00342b] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#707975] mb-0.5">Technical Support</p>
                    <p className="text-sm text-[#1b1c1c] group-hover:text-[#00342b] transition-colors">{COMPANY.emailSupport}</p>
                  </div>
                </a>
                <a href={COMPANY.phoneLink} className={`flex items-start gap-3 group ${linkFocusClass}`}>
                  <Phone size={16} className="text-[#00342b] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#707975] mb-0.5">Customer Support</p>
                    <p className="text-sm text-[#1b1c1c] group-hover:text-[#00342b] transition-colors">{COMPANY.phone}</p>
                  </div>
                </a>
                <div className="flex items-start gap-3 border-t border-[#bfc9c4] pt-5">
                  <MapPin size={16} className="text-[#00342b] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#707975] mb-0.5">Headquarters</p>
                    <p className="text-sm text-[#1b1c1c]">{COMPANY.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp CTA */}
            <a
              href={COMPANY.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => posthog.capture('whatsapp_contact_clicked')}
              className={`flex items-center flex-wrap justify-between gap-3 border border-[#00342b] bg-[#00342b]/5 p-6 hover:bg-[#00342b] hover:text-white group transition-colors ${linkFocusClass}`}
            >
              <div>
                <p className="text-xs font-semibold text-[#065043] group-hover:text-[#afefdd] uppercase tracking-widest mb-1 transition-colors">Quick Contact</p>
                <p className="font-[Geist,sans-serif] font-semibold text-[#00342b] group-hover:text-white transition-colors">Chat on WhatsApp</p>
              </div>
              <MessageCircle size={24} className="text-[#00342b] group-hover:text-[#afefdd] transition-colors" />
            </a>

            {/* Location visual */}
            <div className="border border-[#bfc9c4] bg-[#efeded] p-8 text-center">
              <MapPin size={32} className="text-[#00342b] mx-auto mb-3" />
              <p className="font-[Geist,sans-serif] font-semibold text-[#1b1c1c] mb-1">Main Hub: Ubungo</p>
              <p className="text-sm text-[#3f4945]">Temboni, Ubungo, Dar es Salaam</p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <div className="w-2 h-2 bg-[#00342b] rounded-full animate-pulse" />
                <span className="text-xs text-[#707975]">Active office — Mon–Fri 8AM–5PM EAT</span>
              </div>
            </div>

            {/* Hub photo */}
            <div className="relative flex-1 min-h-[200px] overflow-hidden border border-[#bfc9c4]">
              <Image
                src="/main-hub.jpg"
                alt="BizLink Africa Main Hub, Ubungo Dar es Salaam"
                fill
                className="object-cover object-center"
                sizes="(max-width: 768px) 100vw, 400px"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
