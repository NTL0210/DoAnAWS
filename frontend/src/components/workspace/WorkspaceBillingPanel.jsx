import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiFileText,
  FiHardDrive,
  FiShield,
  FiTrendingUp,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import {
  formatMoneyUsd,
  formatMoneyVnd,
  formatPlanLimit,
  getPlanRank,
  getPricingPlans,
  getUsageAlerts,
  getWorkspacePlan,
} from '@/services/billingService';

export default function WorkspaceBillingPanel({
  activeWorkspace,
  usage,
  onChangePlan,
  currentUserRole,
}) {
  const plans = getPricingPlans();
  const currentPlan = getWorkspacePlan(activeWorkspace);
  const usageAlerts = getUsageAlerts({ plan: currentPlan, usage });

  return (
    <section className="workspace-billing-panel space-y-5">
      <BillingHero currentPlan={currentPlan} usage={usage} usageAlerts={usageAlerts} />

      {currentUserRole && currentUserRole !== 'OWNER' ? (
        <div className="workspace-tactical-panel workspace-cut-corner flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500/12 text-orange-600 dark:text-orange-300">
            <FiZap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-black text-slate-950 dark:text-slate-100">Support this workspace</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 dark:text-slate-400">
              Any member can upgrade. Downgrades stay owner-controlled so quota, retention, and team governance do not surprise the workspace.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlan}
            currentUserRole={currentUserRole}
            onChangePlan={onChangePlan}
          />
        ))}
      </div>

      <PlanComparison plans={plans} />
    </section>
  );
}

function BillingHero({ currentPlan, usage, usageAlerts }) {
  const metrics = [
    {
      label: 'Audio minutes',
      value: usage.audioMinutesUsed || 0,
      limit: currentPlan.includedAudioMinutesMonthly,
      icon: FiClock,
      accent: 'orange',
    },
    {
      label: 'AI credits',
      value: usage.aiCreditsUsed || 0,
      limit: currentPlan.includedAiCreditsMonthly,
      icon: FiCpu,
      accent: 'blue',
    },
    {
      label: 'Members',
      value: usage.memberCount || 0,
      limit: currentPlan.maxMembers,
      icon: FiUsers,
      accent: 'emerald',
    },
    {
      label: 'Teams',
      value: usage.teamCount || 0,
      limit: currentPlan.maxTeamsPerWorkspace,
      icon: FiHardDrive,
      accent: 'violet',
    },
  ];

  return (
    <div className="workspace-billing-hero workspace-cut-corner relative overflow-hidden p-5 text-white md:p-6">
      <div className="workspace-billing-grid" aria-hidden="true" />
      <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_1.1fr] xl:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-orange-100">
            <FiShield className="h-3.5 w-3.5" />
            Billing and governance
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight md:text-3xl">
            Scale meeting execution without losing control.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Current plan: <span className="font-black text-white">{currentPlan.name}</span>. Quotas protect AWS cost while keeping AI review, retention, and task governance visible to the team.
          </p>

          {usageAlerts.length > 0 ? (
            <div className="mt-4 space-y-2">
              {usageAlerts.map((alert) => (
                <div
                  key={alert.message}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                    alert.level === 'critical'
                      ? 'border-red-300/30 bg-red-500/14 text-red-100'
                      : alert.level === 'info'
                        ? 'border-blue-300/30 bg-blue-500/14 text-blue-100'
                        : 'border-amber-300/30 bg-amber-500/14 text-amber-100'
                  }`}
                >
                  <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {alert.message}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-100">
              <FiCheckCircle className="h-3.5 w-3.5" />
              Usage is healthy for this billing cycle.
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <UsageMetric key={metric.label} {...metric} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UsageMetric({ label, value, limit, icon: Icon, accent }) {
  const unlimited = limit === Infinity;
  const percent = unlimited || !limit ? 0 : Math.min(100, Math.round((value / limit) * 100));
  const toneClass = {
    orange: 'from-orange-500 to-red-500',
    blue: 'from-blue-500 to-cyan-400',
    emerald: 'from-emerald-500 to-teal-400',
    violet: 'from-violet-500 to-fuchsia-400',
  }[accent] || 'from-orange-500 to-red-500';

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.08] p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-slate-300">{label}</p>
          <p className="mt-1 text-xl font-black text-white">
            {value.toLocaleString()}
            <span className="ml-1 text-xs font-bold text-slate-400">/ {formatPlanLimit(limit)}</span>
          </p>
        </div>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${toneClass} text-white shadow-lg`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${toneClass}`}
          style={{ width: unlimited ? '100%' : `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] font-bold text-slate-400">
        {unlimited ? 'No plan cap' : `${percent}% used`}
      </p>
    </div>
  );
}

function PlanCard({ plan, currentPlan, currentUserRole, onChangePlan }) {
  const active = plan.id === currentPlan.id;
  const currentPlanRank = getPlanRank(currentPlan.id);
  const planRank = getPlanRank(plan.id);
  const isUpgrade = planRank > currentPlanRank;
  const isDowngrade = planRank < currentPlanRank;
  const canActOnThisPlan = isUpgrade || ['OWNER', 'VICE_ADMIN'].includes(currentUserRole);
  const isOwnerOrViceAdmin = ['OWNER', 'VICE_ADMIN'].includes(currentUserRole);
  const recommended = plan.id === 'business';
  const topFeatures = [
    ...plan.workflowCapabilities.map((text) => ({ icon: FiFileText, text })),
    ...plan.aiFeatures.map((text) => ({ icon: FiZap, text })),
    ...plan.security.map((text) => ({ icon: FiShield, text })),
  ].slice(0, 5);

  const buttonLabel = active
    ? 'Current plan'
    : isUpgrade
      ? `Upgrade to ${plan.name}`
      : isDowngrade && !isOwnerOrViceAdmin
        ? 'Owner can downgrade'
        : `Switch to ${plan.name}`;

  return (
    <article className={`workspace-plan-card workspace-cut-corner ${active ? 'is-active' : ''} ${recommended ? 'is-recommended' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-slate-950 dark:text-slate-100">{plan.name}</h3>
            {recommended ? <PlanBadge tone="orange">Recommended</PlanBadge> : null}
            {active ? <PlanBadge tone="emerald">Active</PlanBadge> : null}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{plan.targetCustomer}</p>
        </div>
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-lg dark:bg-white dark:text-slate-950">
          {active ? <FiCheckCircle className="h-5 w-5" /> : <FiTrendingUp className="h-5 w-5" />}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{formatMoneyUsd(plan.priceUsdMonthly)}</p>
        <p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500">{formatMoneyVnd(plan.priceVndMonthly)} / month</p>
      </div>

      <p className="mt-4 min-h-[58px] text-sm leading-6 text-slate-600 dark:text-slate-300">
        {plan.businessOutcome}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <PlanLimit label="Audio" value={formatPlanLimit(plan.includedAudioMinutesMonthly, 'min')} />
        <PlanLimit label="Members" value={formatPlanLimit(plan.maxMembers)} />
        <PlanLimit label="AI jobs" value={formatPlanLimit(plan.concurrentAiJobs)} />
        <PlanLimit label="History" value={plan.meetingHistoryDays >= 2555 ? '7 years' : `${plan.meetingHistoryDays} days`} />
      </div>

      <div className="mt-5 space-y-2.5">
        {topFeatures.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-400">
            <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
              <Icon className="h-2.5 w-2.5" />
            </span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={active || !canActOnThisPlan}
        onClick={() => onChangePlan(plan.id)}
        className={`workspace-command-button mt-5 w-full ${active ? 'is-muted' : isUpgrade ? 'is-primary' : 'is-secondary'}`}
      >
        <span>{buttonLabel}</span>
        {!active && canActOnThisPlan ? <FiArrowUpRight className="h-4 w-4" /> : null}
      </button>
    </article>
  );
}

function PlanBadge({ tone, children }) {
  const className = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300'
    : 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-300';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

function PlanLimit({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white/72 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-950/30">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function PlanComparison({ plans }) {
  return (
    <div className="workspace-tactical-panel overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-slate-200/70 px-5 py-4 dark:border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-orange-600 dark:text-orange-300">Plan matrix</p>
          <h3 className="mt-1 text-sm font-black text-slate-950 dark:text-slate-100">Operational limits at a glance</h3>
        </div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Compare capacity without leaving settings.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-900/70 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3">Plan</th>
              <th className="px-4 py-3">Audio</th>
              <th className="px-4 py-3">Upload</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Teams</th>
              <th className="px-4 py-3">AI jobs</th>
              <th className="px-4 py-3">Exports</th>
              <th className="px-4 py-3">Support</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {plans.map((plan) => (
              <tr key={plan.id} className="bg-white/60 transition hover:bg-orange-50/45 dark:bg-slate-950/20 dark:hover:bg-orange-950/10">
                <td className="px-5 py-4 font-black text-slate-950 dark:text-slate-100">{plan.name}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.includedAudioMinutesMonthly, 'min')}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{plan.maxUploadMbPerFile} MB</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.maxMembers)}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.maxTeamsPerWorkspace)}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.concurrentAiJobs)}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{plan.exportFormats.slice(0, 2).join(', ')}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{plan.support}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
