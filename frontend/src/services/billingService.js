import { AWS_COST_ASSUMPTIONS, DEFAULT_PLAN_ID, PLAN_ORDER, PRICING_PLANS } from '@/domain/billing/pricingPlans';

const BYTES_PER_MB = 1024 * 1024;

export function getPricingPlans() {
  return PRICING_PLANS;
}

export function getPlanById(planId) {
  return PRICING_PLANS.find((plan) => plan.id === planId) || PRICING_PLANS.find((plan) => plan.id === DEFAULT_PLAN_ID);
}

export function getWorkspacePlan(workspace) {
  return getPlanById(workspace?.billingPlanId || DEFAULT_PLAN_ID);
}

export function formatPlanLimit(value, unit = '') {
  if (value === Infinity) return 'Unlimited';
  return `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
}

export function formatMoneyUsd(value) {
  if (value === null || value === undefined) return 'Custom';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

export function formatMoneyVnd(value) {
  if (value === null || value === undefined) return 'Custom';
  if (!value) return '0 VND';
  return `${new Intl.NumberFormat('vi-VN').format(value)} VND`;
}

export function estimateAudioMinutesFromFile(file) {
  if (!file?.size) return 0;
  // The architecture doc assumes roughly 60 MB/hour, so 1 MB ~= 1 minute.
  return Math.max(1, Math.ceil(file.size / BYTES_PER_MB));
}

export function getMeetingAudioMinutes(meeting) {
  if (!meeting) return 0;
  if (typeof meeting.audioMinutes === 'number') return meeting.audioMinutes;
  if (typeof meeting.durationMinutes === 'number') return meeting.durationMinutes;
  if (typeof meeting.durationSeconds === 'number') return Math.ceil(meeting.durationSeconds / 60);
  if (meeting.audioFile?.size) return Math.max(1, Math.ceil(meeting.audioFile.size / BYTES_PER_MB));
  if (meeting.fileSize) return Math.max(1, Math.ceil(meeting.fileSize / BYTES_PER_MB));
  return meeting.type === 'AUDIO' ? 30 : 0;
}

export function getWorkspaceUsageSnapshot({ workspace, meetings = [], members = [] }) {
  const workspaceMeetings = meetings.filter((meeting) => meeting.workspaceId === workspace?.id && !meeting.deletedAt);
  const audioMinutesUsed = workspaceMeetings.reduce((total, meeting) => total + getMeetingAudioMinutes(meeting), 0);
  const storageMbUsed = workspaceMeetings.reduce((total, meeting) => {
    const size = meeting.audioFile?.size || meeting.fileSize || 0;
    return total + size / BYTES_PER_MB;
  }, 0);

  // AI credits consumed: count meetings that have been AI-processed
  const aiCreditsUsed = workspaceMeetings.filter((m) =>
    m.status === 'COMPLETED' || m.aiSummary || m.summary || m.tasksExtracted
  ).length;

  return {
    workspaceId: workspace?.id || null,
    audioMinutesUsed,
    storageMbUsed: Math.round(storageMbUsed),
    meetingCount: workspaceMeetings.length,
    memberCount: members.length,
    teamCount: workspace?.teams?.length || 0,
    aiCreditsUsed,
  };
}

export function estimateAwsCostForMinutes(audioMinutes, meetingCount = 0, assumptions = AWS_COST_ASSUMPTIONS) {
  const inputTokens = audioMinutes * assumptions.averageInputTokensPerAudioMinute;
  const outputTokens = audioMinutes * assumptions.averageOutputTokensPerAudioMinute;
  const transcribe = audioMinutes * assumptions.transcribeUsdPerMinute;
  const bedrock = (inputTokens / 1_000_000) * assumptions.bedrockInputUsdPerMillionTokens
    + (outputTokens / 1_000_000) * assumptions.bedrockOutputUsdPerMillionTokens;
  const stepFunctions = meetingCount * assumptions.averageStateTransitionsPerMeeting * assumptions.stepFunctionUsdPerStateTransition;
  const s3 = (audioMinutes / 60) * 0.06 * assumptions.s3StandardUsdPerGbMonth;
  const dynamodb = Math.max(0.01, (meetingCount / 1_000_000) * assumptions.dynamodbUsdPerMillionWriteUnits * 4);

  return {
    transcribe,
    bedrock,
    stepFunctions,
    s3,
    dynamodb,
    variableTotal: transcribe + bedrock + stepFunctions + s3 + dynamodb,
  };
}

export function estimatePlanUnitEconomics(plan) {
  const meetingCount = Math.max(1, Math.ceil(plan.includedAudioMinutesMonthly / 30));
  const aws = estimateAwsCostForMinutes(plan.includedAudioMinutesMonthly, meetingCount);
  const bufferedAwsCost = aws.variableTotal * plan.awsCostBufferMultiplier + AWS_COST_ASSUMPTIONS.platformOverheadUsdPerWorkspace;
  const grossMarginUsd = typeof plan.priceUsdMonthly === 'number' ? plan.priceUsdMonthly - bufferedAwsCost : null;
  const grossMarginPercent = plan.priceUsdMonthly > 0 ? (grossMarginUsd / plan.priceUsdMonthly) * 100 : null;

  return {
    ...aws,
    bufferedAwsCost,
    grossMarginUsd,
    grossMarginPercent,
  };
}

export function getPlanRank(planId) {
  const index = PLAN_ORDER.indexOf(planId);
  return index === -1 ? 0 : index;
}

export function getUsageAlerts({ plan, usage }) {
  if (!plan || !usage) return [];
  const alerts = [];
  const minutesPercent = plan.includedAudioMinutesMonthly > 0
    ? usage.audioMinutesUsed / plan.includedAudioMinutesMonthly
    : 0;
  if (minutesPercent >= 0.95) {
    alerts.push({
      level: 'critical',
      message: `${plan.name} is at ${Math.round(minutesPercent * 100)}% of monthly AI audio minutes. New uploads may be delayed or require an upgrade soon.`,
    });
  } else if (minutesPercent >= 0.85) {
    alerts.push({
      level: 'warning',
      message: `${plan.name} has used ${Math.round(minutesPercent * 100)}% of monthly AI audio minutes. Route only high-value meetings to AI for the rest of the month.`,
    });
  } else if (minutesPercent >= 0.7) {
    alerts.push({
      level: 'info',
      message: `${plan.name} has used ${Math.round(minutesPercent * 100)}% of monthly AI minutes. Consider summarizing transcripts instead of uploading long raw audio.`,
    });
  }

  if (plan.maxMembers !== Infinity && usage.memberCount >= plan.maxMembers) {
    alerts.push({
      level: 'warning',
      message: `${plan.name} is at its recommended ${plan.maxMembers}-member team size. You can keep demoing, but Business gives cleaner member governance.`,
    });
  }

  if (plan.maxTeamsPerWorkspace !== Infinity && usage.teamCount >= plan.maxTeamsPerWorkspace) {
    alerts.push({
      level: 'warning',
      message: `${plan.name} is at its recommended ${plan.maxTeamsPerWorkspace}-team structure. Consider upgrading when team workflows become recurring.`,
    });
  }

  return alerts;
}

export function validatePlanChange({ currentPlan, targetPlan, usage }) {
  if (!targetPlan) return { allowed: false, message: 'Selected plan was not found.' };
  if (!usage) return { allowed: true, message: '' };

  const checks = [
    [targetPlan.includedAudioMinutesMonthly !== Infinity && usage.audioMinutesUsed > targetPlan.includedAudioMinutesMonthly, `${targetPlan.name} only includes ${targetPlan.includedAudioMinutesMonthly.toLocaleString()} monthly audio minutes.`],
  ];

  const failed = checks.find(([blocked]) => blocked);
  if (failed) {
    return {
      allowed: false,
      message: `Cannot switch from ${currentPlan?.name || 'current plan'} to ${targetPlan.name}. ${failed[1]} Reduce usage or choose a higher plan.`,
    };
  }

  return { allowed: true, message: '' };
}

export function validateWorkspaceCapacity({ plan, usage }) {
  if (plan.maxMembers !== Infinity && usage.memberCount > plan.maxMembers) {
    return {
      allowed: true,
      warning: true,
      message: `${plan.name} recommends up to ${plan.maxMembers} members. Invite allowed for demo, but upgrade when this workspace becomes an operating team.`,
    };
  }

  if (plan.maxTeamsPerWorkspace !== Infinity && usage.teamCount > plan.maxTeamsPerWorkspace) {
    return {
      allowed: true,
      warning: true,
      message: `${plan.name} recommends up to ${plan.maxTeamsPerWorkspace} teams. Team creation is allowed, but recurring team workflows should move to Business.`,
    };
  }

  return { allowed: true, message: '' };
}

export function validateMeetingProcessing({ plan, usage, file }) {
  const uploadMb = file?.size ? file.size / BYTES_PER_MB : 0;
  const estimatedMinutes = estimateAudioMinutesFromFile(file);

  if (uploadMb > plan.maxUploadMbPerFile) {
    return {
      allowed: false,
      estimatedMinutes,
      message: `${plan.name} supports files up to ${plan.maxUploadMbPerFile} MB. This file is ${Math.ceil(uploadMb)} MB.`,
    };
  }

  if (usage.audioMinutesUsed + estimatedMinutes > plan.includedAudioMinutesMonthly) {
    const remaining = Math.max(0, plan.includedAudioMinutesMonthly - usage.audioMinutesUsed);
    return {
      allowed: false,
      estimatedMinutes,
      message: `${plan.name} has ${remaining} audio minutes remaining this month. This upload is estimated at ${estimatedMinutes} minutes.`,
    };
  }

  return { allowed: true, estimatedMinutes, message: '' };
}
