import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useWorkspace } from '@/context/WorkspaceContext';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import {
    FiArrowLeft,
    FiArrowRight,
    FiCheckCircle,
    FiClock,
    FiDatabase,
    FiLock,
    FiMail,
    FiShield,
    FiUser,
    FiUsers,
} from 'react-icons/fi';

const REMEMBERED_ACCOUNTS_KEY = 'meetingAppRememberedAccounts';

/**
 * Login page with a tactical command UI presentation.
 * Auth/session behavior is intentionally unchanged.
 */
export default function Login() {
    const router = useRouter();
    const { login, register, setUser, currentUser } = useWorkspace();

    const [mode, setMode] = useState('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [rememberedAccounts, setRememberedAccounts] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (currentUser) {
            router.push(getDashboardPath(currentUser));
        }
    }, [currentUser, router]);

    useEffect(() => {
        try {
            const remembered = JSON.parse(localStorage.getItem(REMEMBERED_ACCOUNTS_KEY) || '[]');
            setRememberedAccounts(Array.isArray(remembered) ? remembered.slice(0, 4) : []);
        } catch {
            setRememberedAccounts([]);
        }
    }, []);

    const rememberAccount = (user) => {
        if (!rememberMe || !user?.email) return;
        const account = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar || null,
            lastLoginAt: new Date().toISOString(),
        };
        const next = [
            account,
            ...rememberedAccounts.filter((item) => item.email !== account.email),
        ].slice(0, 4);
        setRememberedAccounts(next);
        localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(next));
    };

    const forgetAccount = (targetEmail) => {
        const next = rememberedAccounts.filter((item) => item.email !== targetEmail);
        setRememberedAccounts(next);
        localStorage.setItem(REMEMBERED_ACCOUNTS_KEY, JSON.stringify(next));
        if (email === targetEmail) setEmail('');
    };

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
                if (password.length < 8) {
                    throw new Error('Password must be at least 8 characters');
                }

                const user = await register(name, email, password);
                await setUser(user);
                rememberAccount(user);
                setSuccess('Account created. Redirecting to your workspace...');
                router.push('/workspace');
                return;
            }

            if (!email || !password) {
                throw new Error('Please fill in all fields');
            }

            const user = await login(email, password);
            await setUser(user);
            rememberAccount(user);
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
        <main className="login-page relative min-h-screen overflow-hidden bg-[#07090d] text-white">
            <AnimatedThemeToggler className="theme-toggler-button fixed right-5 top-5 z-30 border border-white/10 bg-black/55 shadow-xl shadow-black/30 backdrop-blur" />
            <div className="login-scanline" />

            <div className="grid min-h-screen lg:grid-cols-[1.04fr_0.96fr]">
                <section className="relative hidden overflow-hidden px-10 py-9 lg:flex lg:flex-col lg:justify-between xl:px-14">
                    <div className="login-graphic-bg" aria-hidden="true">
                        <div className="login-graphic-grid" />
                        <div className="login-graphic-slab login-graphic-slab-one" />
                        <div className="login-graphic-slab login-graphic-slab-two" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between text-[11px] font-black uppercase text-slate-400">
                        <span>Execution Control</span>
                        <span className="text-[#ff6b35]">Operational AI</span>
                    </div>

                    <div className="relative z-10 grid items-center gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="min-w-0 max-w-3xl">
                            <div className="login-status-chip">
                                <FiCheckCircle className="h-4 w-4 text-[#ff6b35]" />
                                Live workspace command layer
                            </div>
                            <h1 className="mt-8 text-5xl font-black leading-[0.98] text-white xl:text-6xl 2xl:text-[72px]">
                                Meetings are not records.
                                <span className="mt-2 block text-slate-300">They are operations.</span>
                            </h1>
                            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
                                Convert discussion into reviewed decisions, assigned work, and execution visibility across every team.
                            </p>

                            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
                                {[
                                    ['AI', 'review gate'],
                                    ['TASK', 'creation flow'],
                                    ['OPS', 'governance'],
                                ].map(([value, label]) => (
                                    <div key={label} className="login-metric">
                                        <div className="text-2xl font-black text-white">{value}</div>
                                        <div className="mt-1 text-[11px] font-bold uppercase text-slate-400">{label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <CubeSmokeScene />
                    </div>

                    <div className="relative z-10 grid max-w-3xl grid-cols-[1fr_1.2fr] gap-4">
                        <div className="login-brief-card">
                            <FiShield className="h-5 w-5 text-[#ff6b35]" />
                            <div>
                                <p className="text-xs font-black uppercase text-white">Governed access</p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">Session auth, workspace roles, billing gates.</p>
                            </div>
                        </div>
                        <div className="login-brief-card">
                            <FiDatabase className="h-5 w-5 text-[#ff6b35]" />
                            <div>
                                <p className="text-xs font-black uppercase text-white">Execution memory</p>
                                <p className="mt-1 text-xs leading-5 text-slate-400">Meetings, tasks, review history, ownership.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="relative flex items-center justify-center overflow-hidden bg-[#eceff1] px-5 py-10 text-slate-950 dark:bg-[#0b1017] dark:text-white">
                    <div className="absolute inset-0 login-auth-bg" />
                    <div className="relative z-10 w-full max-w-[460px]">
                        <div className="mb-7 lg:hidden">
                            <div className="text-2xl font-black text-slate-950 dark:text-white">AI Meeting</div>
                            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Workforce Platform</p>
                            <MobileCubeScene />
                        </div>

                        <div className="login-auth-panel">
                            <div className="mb-7 flex items-start justify-between gap-4">
                                <div>
                                    <div className="login-auth-icon">
                                        {mode === 'login' ? <FiUsers className="h-6 w-6" /> : <FiUser className="h-6 w-6" />}
                                    </div>
                                    <p className="mt-5 text-[11px] font-black uppercase text-[#ff6b35]">
                                        {mode === 'login' ? 'Operator access' : 'Provision account'}
                                    </p>
                                    <h2 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                                        {mode === 'login' ? 'Welcome back' : 'Create your account'}
                                    </h2>
                                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                                        {mode === 'login'
                                            ? 'Authenticate to enter your execution workspace.'
                                            : 'Register to start coordinating meeting outcomes.'}
                                    </p>
                                </div>
                                <div className="hidden rounded-sm border border-slate-200 bg-white px-3 py-2 text-right text-[10px] font-black uppercase text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:block">
                                    <span className="block text-slate-950 dark:text-white">Secure</span>
                                    <span>Session</span>
                                </div>
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
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
                                    <label className="login-check flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                                        <input
                                            type="checkbox"
                                            checked={rememberMe}
                                            onChange={(event) => setRememberMe(event.target.checked)}
                                            className="h-4 w-4 rounded-sm border-slate-300 text-[#ff6b35] focus:ring-[#ff6b35]"
                                        />
                                        Remember this operator
                                    </label>
                                </div>

                                {error && (
                                    <div className="login-alert border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-200">
                                        {error}
                                    </div>
                                )}

                                {success && (
                                    <div className="login-alert border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                                        {success}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="login-submit"
                                >
                                    {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign in' : 'Create account')}
                                    {!loading && <FiArrowRight className="h-4 w-4" />}
                                </button>
                            </form>

                            {mode === 'login' && rememberedAccounts.length > 0 && (
                                <>
                                    <div className="my-6 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                                        <span className="text-[10px] font-black uppercase text-slate-400">quick sign in</span>
                                        <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                                    </div>

                                    <div className="grid gap-2">
                                        {rememberedAccounts.map((account) => (
                                            <div
                                                key={account.email}
                                                className="login-remembered"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEmail(account.email);
                                                        setPassword('');
                                                    }}
                                                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                                                >
                                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-950 text-sm font-black text-white dark:bg-white dark:text-slate-950">
                                                        {(account.name || account.email).slice(0, 1).toUpperCase()}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-black text-slate-800 dark:text-slate-100">{account.name || account.email}</span>
                                                        <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-bold uppercase text-slate-400">
                                                            <FiClock className="h-3 w-3 shrink-0" />
                                                            Recently used
                                                        </span>
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => forgetAccount(account.email)}
                                                    className="px-2 py-1 text-[10px] font-black uppercase text-slate-400 hover:bg-white hover:text-red-500 dark:hover:bg-white/10"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            <p className="mt-6 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {mode === 'login' ? 'No account yet?' : 'Already have an account?'}{' '}
                                <button
                                    type="button"
                                    onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                                    className="inline-flex items-center gap-1 font-black text-[#e84c1f] transition hover:text-[#ff6b35]"
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

function CubeSmokeScene() {
    return (
        <div className="cube-smoke-scene hidden xl:block" aria-hidden="true">
            <div className="cube-scene-frame">
                <div className="cube-scan-beam" />
                <div className="cube-perspective">
                    <div className="cube-orbit-ring cube-orbit-ring-one" />
                    <div className="cube-orbit-ring cube-orbit-ring-two" />
                    <div className="cube-shell">
                        <span className="cube-face cube-face-front" />
                        <span className="cube-face cube-face-back" />
                        <span className="cube-face cube-face-right" />
                        <span className="cube-face cube-face-left" />
                        <span className="cube-face cube-face-top" />
                        <span className="cube-face cube-face-bottom" />
                    </div>
                    <div className="cube-core-glow" />
                </div>
                <div className="cube-particles">
                    {Array.from({ length: 18 }).map((_, index) => (
                        <span key={index} style={{ '--i': index }} />
                    ))}
                </div>
            </div>
            <div className="cube-caption">
                <span>AI Review Core</span>
                <strong>Transcript to execution</strong>
            </div>
            <div className="cube-data-card cube-data-card-one">
                <span>DECISIONS</span>
                <strong>06</strong>
            </div>
            <div className="cube-data-card cube-data-card-two">
                <span>TASK STREAM</span>
                <strong>ACTIVE</strong>
            </div>
            <div className="cube-data-card cube-data-card-three">
                <span>GOVERNANCE</span>
                <strong>LOCKED</strong>
            </div>
            <div className="cube-mini-feed">
                <span />
                <span />
                <span />
                <span />
            </div>
        </div>
    );
}

function MobileCubeScene() {
    return (
        <div className="mobile-cube-scene lg:hidden" aria-hidden="true">
            <div className="cube-perspective cube-perspective-mobile">
                <div className="cube-shell">
                    <span className="cube-face cube-face-front" />
                    <span className="cube-face cube-face-back" />
                    <span className="cube-face cube-face-right" />
                    <span className="cube-face cube-face-left" />
                    <span className="cube-face cube-face-top" />
                    <span className="cube-face cube-face-bottom" />
                </div>
            </div>
        </div>
    );
}

function Input({ id, label, icon: Icon, ...props }) {
    return (
        <div>
            <label htmlFor={id} className="mb-2 block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400">
                {label}
            </label>
            <div className="relative">
                <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    id={id}
                    className="login-input h-12 w-full border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#ff6b35] focus:ring-4 focus:ring-[#ff6b35]/15 dark:border-white/10 dark:bg-[#0f1720] dark:text-white"
                    {...props}
                />
            </div>
        </div>
    );
}

function getDashboardPath(user) {
    if (!user?.role) return '/workspace';
    return '/dashboard';
}
