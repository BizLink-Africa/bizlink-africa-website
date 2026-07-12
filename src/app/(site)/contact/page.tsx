'use client';

import Image from 'next/image';
import { Mail, Phone, MapPin, Send, MessageCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { COMPANY } from '@/data/website';
import { REQUESTED_SOLUTIONS, PREFERRED_CONTACT_METHODS } from '@/data/inquiries';

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
};

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSolutionToggle = (value: string) => {
    setForm((prev) => ({
      ...prev,
      requestedSolution: prev.requestedSolution.includes(value)
        ? prev.requestedSolution.filter((v) => v !== value)
        : [...prev.requestedSolution, value],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (
      !form.fullName ||
      !form.businessName ||
      !form.businessType ||
      !form.location ||
      !form.phone ||
      !form.email
    ) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (form.requestedSolution.length === 0) {
      setErrorMessage('Please select at least one solution you need.');
      return;
    }

    if (!form.consentGiven) {
      setErrorMessage('Please confirm BizLink Africa may contact you about your inquiry.');
      return;
    }

    setSubmitting(true);
    let result: { success: boolean; message: string };
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      result = await response.json();
    } catch {
      result = { success: false, message: 'Something went wrong submitting your inquiry. Please try again.' };
    }
    setSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    setForm(initialForm);
    setSubmitted(true);
  };

  const inputClass =
    'w-full bg-transparent border-b border-[#bfc9c4] py-3 focus:border-[#00342b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 text-[#1b1c1c] text-sm placeholder:text-[#aeb1b1] transition-colors';

  const labelClass = 'block text-xs font-semibold text-[#707975] uppercase tracking-wider mb-1';

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
            Submit your business details and our team will contact you for offline onboarding and consultation.
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
              <form onSubmit={handleSubmit} className="space-y-8">
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
                </div>

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

                <label className="flex items-start gap-3 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.consentGiven}
                    onChange={(e) => setForm((prev) => ({ ...prev, consentGiven: e.target.checked }))}
                    className="w-5 h-5 shrink-0 accent-[#00342b] mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00342b] focus-visible:ring-offset-2 rounded-sm"
                  />
                  <span className="text-sm text-[#3f4945]">
                    I agree that BizLink Africa may contact me about this inquiry.
                  </span>
                </label>

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
                <a href={COMPANY.whatsappLink} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 group ${linkFocusClass}`}>
                  <Phone size={16} className="text-[#00342b] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-[#707975] mb-0.5">Customer Support</p>
                    <p className="text-sm text-[#1b1c1c] group-hover:text-[#00342b] transition-colors">{COMPANY.whatsapp}</p>
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
