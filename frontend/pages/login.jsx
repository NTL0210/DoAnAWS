import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiLock, FiMail, FiUser, FiUsers } from 'react-icons/fi';

/**
 * Login page — Original 3D/2.5D animated design
 * Updated to support workspace-based auth (no role selection on login)
 */
export default function Login() {
  const router = useRouter();
  const { login, register, setUser, currentUser } = useWorkspace();

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (currentUser) {
      router.push(getDashboardPath(currentUser));
    }
  }, [currentUser, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!name || !email || !password || !confirmPassword) {
          throw new Error('Please fill in all fields');
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        const user = await register(name, email, password);
        await setUser(user);
        setSuccess('Account created. Redirecting to your workspace...');
        router.push(getDashboardPath(user));
        return;
      }

      if (!email || !password) {
        throw new Error('Please fill in all fields');
      }

      const user = await login(email, password);
      await setUser(user);
      router.push(getDashboardPath(user));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
    setSuccess('');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        {/* ─── LEFT: 3D/2.5D Animated Scene ─── */}
        <section className="relative hidden overflow-hidden bg-slate-950 px-12 py-10 lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.28),transparent_32%),radial-gradient(circle_at_85%_15%,rgba(14,165,233,0.18),transparent_28%),linear-gradient(135deg,#020617_0%,#0f172a_48%,#111827_100%)]" />
          <div className="absolute inset-x-10 top-28 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />
          <LoginScene />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-sky-100 shadow-2xl shadow-blue-950/40">
              <FiCheckCircle className="h-4 w-4 text-sky-300" />
              AI-powered workforce coordination
            </div>
            <h1 className="mt-10 max-w-2xl text-5xl font-bold leading-tight tracking-normal text-white">
              Turn meetings into decisions, tasks, and accountable follow-up.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              Upload transcripts, extract action items, monitor team progress, and keep every role aligned from one focused workspace.
            </p>
            <div className="mt-10 h-32 w-72">
              <NodeConstellation />
            </div>
          </div>

          <div className="relative z-10 grid max-w-2xl grid-cols-3 gap-4">
            {[
              ['24', 'meetings processed'],
              ['86%', 'task clarity score'],
              ['3', 'role dashboards'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <div className="text-3xl font-bold text-white">{value}</div>
                <div className="mt-2 text-sm text-slate-300">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── RIGHT: Login Form ─── */}
        <section className="flex items-center justify-center bg-[#eef3f8] px-5 py-10 text-slate-900 dark:bg-[#101820] dark:text-white">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">AI Meeting</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Workforce Platform</p>
            </div>

            <div className="rounded-lg border border-slate-200/80 bg-[#fbfcfe] p-6 shadow-xl shadow-slate-300/40 dark:border-slate-800 dark:bg-[#17212c] dark:shadow-black/20 sm:p-8">
              <div className="mb-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-600 text-white shadow-lg shadow-primary-600/25">
                  {mode === 'login' ? <FiUsers className="h-6 w-6" /> : <FiUser className="h-6 w-6" />}
                </div>
                <h2 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {mode === 'login'
                    ? 'Sign in to manage your workspaces and tasks.'
                    : 'Register to start collaborating with your team.'}
                </p>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {mode === 'register' && (
                  <Input
                    id="name"
                    label="Full name"
                    icon={FiUser}
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Nguyen Van A"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                )}

                <Input
                  id="email"
                  label="Email"
                  icon={FiMail}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                  id="password"
                  label="Password"
                  icon={FiLock}
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                {mode === 'register' && (
                  <Input
                    id="confirmPassword"
                    label="Confirm password"
                    icon={FiLock}
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                )}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    Remember me
                  </label>
                </div>

                {error && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
                >
                  {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Create account')}
                  {!loading && <FiArrowRight className="h-4 w-4" />}
                </button>
              </form>

              {/* Demo Accounts */}
              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
                <span className="text-xs text-slate-400">demo accounts</span>
                <div className="flex-1 border-t border-slate-200 dark:border-slate-700" />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('123456');
                    }}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center text-xs transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{acc.name}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{acc.role}</div>
                  </button>
                ))}
              </div>

              <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                  className="inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
                >
                  {mode === 'login' ? 'Request access' : 'Back to sign in'}
                  {mode === 'register' && <FiArrowLeft className="h-3.5 w-3.5" />}
                </button>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ─── 3D Login Scene (Original) ─── */
function LoginScene() {
  return (
    <div className="login-scene pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <div className="scene-grid" />
      <div className="scene-stage">
        <div className="scene-orbit scene-orbit-one">
          <span>AI summary</span>
        </div>
        <div className="scene-orbit scene-orbit-two">
          <span>Task sync</span>
        </div>
        <div className="scene-card scene-card-one">
          <strong>Q3 Planning</strong>
          <span>12 action items</span>
        </div>
        <div className="scene-card scene-card-two">
          <strong>Team Load</strong>
          <span>86% balanced</span>
        </div>
        <div className="scene-cube">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function NodeConstellation() {
  return (
    <div className="node-scene" aria-hidden="true">
      <div className="node-ring">
        <span className="node node-one" />
        <span className="node node-two" />
        <span className="node node-three" />
        <span className="node node-four" />
        <span className="node-line node-line-one" />
        <span className="node-line node-line-two" />
        <span className="node-line node-line-three" />
      </div>
    </div>
  );
}

function Input({ id, label, icon: Icon, ...props }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          className="h-11 w-full rounded-md border border-slate-200 bg-[#fbfcfe] pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-primary-950"
          {...props}
        />
      </div>
    </div>
  );
}

const demoAccounts = [
  { name: 'Alex J.', email: 'alex@company.com', role: 'Owner' },
  { name: 'Sarah C.', email: 'sarah@company.com', role: 'Manager' },
  { name: 'John D.', email: 'john@company.com', role: 'Employee' },
];

function getDashboardPath(user) {
  if (!user?.role) return '/workspace';
  if (user?.role === 'EMPLOYEE') return '/employee/dashboard';
  if (user?.role === 'MANAGER') return '/manager/dashboard';
  return '/admin/dashboard';
}
