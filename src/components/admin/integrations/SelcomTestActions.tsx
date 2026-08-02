'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { testSandboxConnection, checkAccountBalance, verifyCallbackConfiguration } from '@/app/admin/(protected)/settings/integrations/selcom/actions';

export default function SelcomTestActions({ canTest, canBalance }: { canTest: boolean; canBalance: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<'test' | 'balance' | 'callback' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(kind: 'test' | 'balance' | 'callback', action: () => Promise<{ success: boolean; message?: string }>) {
    setPending(kind);
    setError(null);
    setMessage(null);
    const result = await action();
    setPending(null);
    if (!result.success) {
      setError(result.message ?? 'Action failed.');
      return;
    }
    setMessage(result.message ?? 'Done.');
    router.refresh();
  }

  async function handleBalance() {
    setPending('balance');
    setError(null);
    setMessage(null);
    const result = await checkAccountBalance();
    setPending(null);
    if (!result.success) {
      setError(result.message ?? 'Balance check failed.');
      return;
    }
    setMessage(`Available balance: ${result.balance} ${result.currency}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3">{error}</p>}
      {message && <p className="text-sm text-[#1b7a3d] bg-green-50 border border-green-200 px-4 py-3">{message}</p>}

      <div className="flex flex-wrap gap-2">
        {canTest && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => run('test', testSandboxConnection)}
            className="text-sm font-medium text-white bg-[#00342b] px-4 py-2 hover:bg-[#004d40] transition-colors disabled:opacity-60"
          >
            {pending === 'test' ? 'Testing…' : 'Test Sandbox Connection'}
          </button>
        )}

        {canBalance && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={handleBalance}
            className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
          >
            {pending === 'balance' ? 'Checking…' : 'Check Account Balance'}
          </button>
        )}

        {canTest && (
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => run('callback', verifyCallbackConfiguration)}
            className="text-sm font-medium text-[#00342b] border border-[#00342b] px-4 py-2 hover:bg-[#00342b] hover:text-white transition-colors disabled:opacity-60"
          >
            {pending === 'callback' ? 'Verifying…' : 'Verify Callback Configuration'}
          </button>
        )}
      </div>
    </div>
  );
}
