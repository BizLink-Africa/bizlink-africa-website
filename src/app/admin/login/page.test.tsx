import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminLoginPage from './page';

const { signInWithPassword, maybeSingle, eq, select, from, push, refresh, recordLoginEvent } = vi.hoisted(() => {
  return {
    signInWithPassword: vi.fn(),
    maybeSingle: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    from: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
    recordLoginEvent: vi.fn(async () => {}),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: { signInWithPassword },
    from,
  })),
}));

vi.mock('./actions', () => ({
  recordLoginEvent,
}));

const VALID_EMAIL = 'staff-member@bizlinkafrica.net';
const VALID_PASSWORD = 'a-strong-password';

function setupSupabaseChain() {
  eq.mockReturnValue({ maybeSingle });
  select.mockReturnValue({ eq });
  from.mockReturnValue({ select });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSupabaseChain();
  window.history.pushState({}, '', '/admin/login');
});

describe('AdminLoginPage — rendering', () => {
  it('renders the sign-in form with empty, non-hardcoded credential fields', () => {
    render(<AdminLoginPage />);

    expect(screen.getByRole('heading', { name: /welcome to bizlink africa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sign in to your account/i })).toBeInTheDocument();

    const email = screen.getByLabelText(/^email$/i) as HTMLInputElement;
    const password = screen.getByLabelText(/^password$/i) as HTMLInputElement;
    expect(email.value).toBe('');
    expect(password.value).toBe('');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  it('does not show a "Forgot password?" link — no password recovery flow is implemented yet', () => {
    render(<AdminLoginPage />);
    expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
  });

  it('does not overflow horizontally and stacks on mobile before splitting at md', () => {
    const { container } = render(<AdminLoginPage />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/overflow-x-hidden/);
    expect(root.className).toMatch(/flex-col/);
    expect(root.className).toMatch(/md:flex-row/);
  });
});

describe('AdminLoginPage — responsive layout', () => {
  it('keeps the branding panel readable on desktop (~42-48% width) via lg:w-[45%]', () => {
    const { container } = render(<AdminLoginPage />);
    const panel = container.querySelector('.bg-gradient-to-br');
    expect(panel?.className).toMatch(/lg:w-\[45%\]/);
  });

  it('narrows the branding panel on tablet instead of stacking (md:w-[38%])', () => {
    const { container } = render(<AdminLoginPage />);
    const panel = container.querySelector('.bg-gradient-to-br');
    expect(panel?.className).toMatch(/md:w-\[38%\]/);
  });

  it('shows a collapsible contact section on mobile only (md:hidden) and the full block from md up', () => {
    const { container } = render(<AdminLoginPage />);
    const collapsible = container.querySelector('details');
    expect(collapsible?.className).toMatch(/md:hidden/);

    const [desktopHeading] = screen.getAllByText('Need Assistance?');
    const fullBlock = desktopHeading.closest('div')?.parentElement;
    expect(fullBlock?.className).toMatch(/hidden/);
    expect(fullBlock?.className).toMatch(/md:block/);
  });
});

describe('AdminLoginPage — contact details', () => {
  it('displays the approved BizLink Africa contact information', () => {
    render(<AdminLoginPage />);
    expect(document.body.textContent).toContain('support@bizlinkafrica.net');
    expect(document.body.textContent).toContain('+255 747 730 270');
    expect(document.body.textContent).toContain('Temboni, Ubungo, Dar es Salaam');
    expect(document.body.textContent).toContain('BizLink Africa');
  });
});

describe('AdminLoginPage — validation', () => {
  it('requires both email and password before attempting to sign in', async () => {
    render(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/email and password are required/i);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });
});

describe('AdminLoginPage — password visibility toggle', () => {
  it('toggles the password field between masked and visible', async () => {
    render(<AdminLoginPage />);
    const user = userEvent.setup();

    const password = screen.getByLabelText(/^password$/i);
    expect(password).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(password).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(password).toHaveAttribute('type', 'password');
  });
});

describe('AdminLoginPage — failed sign-in', () => {
  it('shows a generic error and logs a failed audit entry, without confirming account existence', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    render(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), VALID_EMAIL);
    await user.type(screen.getByLabelText(/^password$/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Unable to sign in. Check your credentials and try again.');
    expect(alert.textContent).not.toMatch(/invalid login credentials/i);

    expect(recordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({ email: VALID_EMAIL, success: false })
    );
    expect(push).not.toHaveBeenCalled();
  });
});

describe('AdminLoginPage — loading state', () => {
  it('disables the submit button and shows a signing-in state while the request is in flight', async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      })
    );
    maybeSingle.mockResolvedValue({ data: { role: 'ceo' } });

    render(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), VALID_EMAIL);
    await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const button = screen.getByRole('button', { name: /signing in/i });
    expect(button).toBeDisabled();

    resolveSignIn({ data: { user: { id: 'user-1' } }, error: null });
    await waitFor(() => expect(push).toHaveBeenCalled());
  });
});

describe('AdminLoginPage — role-based redirect', () => {
  it.each([
    ['super_admin', '/admin'],
    ['ceo', '/admin/ceo'],
    ['cfo', '/admin/finance'],
    ['cto', '/admin/cto'],
    ['operations', '/admin/operations'],
    ['customer_support', '/admin/support'],
    ['marketing', '/admin/marketing'],
    ['compliance_security', '/admin/compliance'],
  ])('sends a signed-in %s to %s', async (role, expectedRoute) => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role } });

    render(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), VALID_EMAIL);
    await user.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD);
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(expectedRoute));
    // refresh() must NOT fire alongside push() here — doing so in the real
    // App Router interrupts the pending push navigation before it commits,
    // which is exactly the "stuck on Signing in… until a manual reload" bug
    // this regression-tests against.
    expect(refresh).not.toHaveBeenCalled();
    expect(recordLoginEvent).toHaveBeenCalledWith(
      expect.objectContaining({ email: VALID_EMAIL, success: true })
    );
  });
});

describe('AdminLoginPage — keyboard submission', () => {
  it('submits the form when Enter is pressed inside the password field', async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    maybeSingle.mockResolvedValue({ data: { role: 'super_admin' } });

    render(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^email$/i), VALID_EMAIL);
    await user.type(screen.getByLabelText(/^password$/i), `${VALID_PASSWORD}{Enter}`);

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({ email: VALID_EMAIL, password: VALID_PASSWORD }));
  });
});
