import { FiAlertTriangle, FiCheck, FiCheckCircle, FiFileText, FiShield, FiZap } from 'react-icons/fi';
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
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6 shadow-sm">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-blue-600 dark:text-blue-400">Billing, quota, and workflow policy</p>
          <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">Meeting intelligence plans</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Plans map AI meeting capture to concrete operations: reviewed task creation, evidence retention, team governance, and AWS cost control.
          </p>
        </div>
        <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-black text-white shadow-sm">
          ✓ Current plan: {currentPlan.name}
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <UsageMetric label="Audio minutes" value={`${usage.audioMinutesUsed}/${currentPlan.includedAudioMinutesMonthly}`} />
        <UsageMetric label="AI credits" value={`${usage.aiCreditsUsed || 0}/${currentPlan.includedAiCreditsMonthly}`} />
        <UsageMetric label="Members" value={`${usage.memberCount}/${formatPlanLimit(currentPlan.maxMembers)}`} />
        <UsageMetric label="Teams" value={`${usage.teamCount}/${formatPlanLimit(currentPlan.maxTeamsPerWorkspace)}`} />
      </div>

      {usageAlerts.length > 0 ? (
        <div className="mb-5 space-y-2">
          {usageAlerts.map((alert) => (
            <div
              key={alert.message}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                alert.level === 'critical'
                  ? 'border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                  : alert.level === 'info'
                    ? 'border-blue-100 dark:border-blue-900/30 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
              }`}
            >
              <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {alert.message}
            </div>
          ))}
        </div>
      ) : null}

      {currentUserRole && currentUserRole !== 'OWNER' && (
        <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex items-start gap-3">
          <span className="text-xl">⚡</span>
          <div>
            <p className="text-sm font-black text-amber-800 dark:text-amber-300">Support this workspace</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700 dark:text-amber-400">
              Any member can upgrade the workspace plan. Upgrading gives everyone more audio minutes, members, and AI features — like boosting a Discord server.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const active = plan.id === currentPlan.id;
          const currentPlanRank = getPlanRank(currentPlan.id);
          const planRank = getPlanRank(plan.id);
          const isUpgrade = planRank > currentPlanRank;
          const isDowngrade = planRank < currentPlanRank;
          const canActOnThisPlan = isUpgrade || ['OWNER', 'VICE_ADMIN'].includes(currentUserRole);
          const isOwnerOrViceAdmin = ['OWNER', 'VICE_ADMIN'].includes(currentUserRole);

          const buttonLabel = active
            ? '✓ Current plan'
            : isUpgrade
              ? `⬆ Upgrade to ${plan.name}`
              : isDowngrade && !isOwnerOrViceAdmin
                ? 'Owner can downgrade'
                : `Switch to ${plan.name}`;

          const buttonClass = active
            ? 'cursor-default bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            : isUpgrade
              ? 'bg-amber-500 hover:bg-amber-600 text-white font-black shadow-sm'
              : canActOnThisPlan
                ? 'bg-slate-950 dark:bg-blue-600 text-white hover:bg-blue-700'
                : 'cursor-not-allowed opacity-40 bg-slate-200 dark:bg-slate-700 text-slate-400';

          // Collect top features for compact display
          const topFeatures = [
            ...plan.workflowCapabilities.map((f) => ({ group: 'Workflow', text: f })),
            ...plan.aiFeatures.map((f) => ({ group: 'AI', text: f })),
            ...plan.security.map((f) => ({ group: 'Security', text: f })),
          ].slice(0, 5);

          return (
            <article
              key={plan.id}
              className={`flex flex-col rounded-xl border p-4 shadow-sm transition ${
                active ? 'border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-900/20 shadow-blue-100 dark:shadow-blue-950' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-950 dark:text-slate-100">{plan.name}</h3>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{plan.targetCustomer}</p>
                </div>
                {active ? <FiCheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" /> : null}
                {!active && plan.priceUsdMonthly > 0 && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-xs font-black text-amber-700 dark:text-amber-400 shrink-0">
                    UPGRADE
                  </span>
                )}
              </div>

              {/* ── Price ── */}
              <div className="mt-3">
                <p className="text-2xl font-black text-slate-950 dark:text-slate-100">{formatMoneyUsd(plan.priceUsdMonthly)}</p>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500">{formatMoneyVnd(plan.priceVndMonthly)} / month</p>
              </div>

              {/* ── Business outcome (compact) ── */}
              <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-400 italic">
                {plan.businessOutcome}
              </p>

              {/* ── Specs grid ── */}
              <PlanRows plan={plan} />

              {/* ── Top features ── */}
              <div className="mt-3 flex flex-col gap-1">
                {topFeatures.map((f) => (
                  <div key={f.text} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <FiCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    <span>{f.text}</span>
                  </div>
                ))}
              </div>

              {/* ── Button ── */}
              <button
                type="button"
                disabled={active || !canActOnThisPlan}
                onClick={() => onChangePlan(plan.id)}
                className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-black transition ${buttonClass}`}
              >
                {buttonLabel}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Audio/month</th>
              <th className="px-4 py-3">Upload/file</th>
              <th className="px-4 py-3">Members</th>
              <th className="px-4 py-3">Workspace/team</th>
              <th className="px-4 py-3">AI jobs</th>
              <th className="px-4 py-3">Exports</th>
              <th className="px-4 py-3">History</th>
              <th className="px-4 py-3">Support</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {plans.map((plan) => (
              <tr key={plan.id} className="bg-white dark:bg-slate-900/40">
                <td className="px-4 py-3 font-black text-slate-900 dark:text-slate-100">{plan.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.includedAudioMinutesMonthly, 'min')}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{plan.maxUploadMbPerFile} MB</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.maxMembers)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                  {formatPlanLimit(plan.maxWorkspaces)} / {formatPlanLimit(plan.maxTeamsPerWorkspace)}
                </td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatPlanLimit(plan.concurrentAiJobs)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{plan.exportFormats.join(', ')}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{plan.meetingHistoryDays >= 2555 ? 'Custom / 7 years' : `${plan.meetingHistoryDays} days`}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{plan.support}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UsageMetric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-3">
      <p className="text-xs font-bold uppercase text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950 dark:text-slate-100">{value}</p>
    </div>
  );
}

function PlanRows({ plan }) {
  const groups = [
    {
      label: 'Limits',
      rows: [
        ['Audio/month', formatPlanLimit(plan.includedAudioMinutesMonthly, 'min')],
        ['Upload/file', `${plan.maxUploadMbPerFile} MB`],
        ['AI credits', formatPlanLimit(plan.includedAiCreditsMonthly, 'credits')],
        ['Voice', formatPlanLimit(plan.voiceRecordingMinutesMonthly, 'min/month')],
      ],
    },
    {
      label: 'Team',
      rows: [
        ['Members', formatPlanLimit(plan.maxMembers)],
        ['Workspaces', formatPlanLimit(plan.maxWorkspaces)],
        ['Teams/ws', formatPlanLimit(plan.maxTeamsPerWorkspace)],
      ],
    },
    {
      label: 'Operations',
      rows: [
        ['AI jobs', formatPlanLimit(plan.concurrentAiJobs)],
        ['Overage', plan.overageUsdPerMinute ? `${formatMoneyUsd(plan.overageUsdPerMinute)}/min` : 'Requires upgrade'],
        ['History', plan.meetingHistoryDays >= 2555 ? 'Custom / 7y' : `${plan.meetingHistoryDays}d`],
      ],
    },
  ];

  return (
    <div className="mt-3 space-y-2.5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">{label}</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
