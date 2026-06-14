export const MAX_VOICE_RECORDING_SIZE_BYTES = 400 * 1024 * 1024;
export const WARNING_VOICE_RECORDING_SIZE_BYTES = 350 * 1024 * 1024;

export const SUPPORTED_VOICE_AUDIO_TYPES = [
  'audio/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/mp4',
  'audio/m4a',
];

export function normalizeVoiceChannel(channel = {}, fallback = {}) {
  const now = new Date().toISOString();
  const isDefault = Boolean(channel.isDefault);
  return {
    ...channel,
    scope: channel.scope || (isDefault ? 'WORKSPACE' : channel.teamId ? 'TEAM' : 'WORKSPACE'),
    teamId: channel.teamId || null,
    allowedTeamIds: channel.allowedTeamIds || (channel.teamId ? [channel.teamId] : []),
    allowedUserIds: channel.allowedUserIds || [],
    deniedUserIds: channel.deniedUserIds || [],
    isDefault,
    isLocked: Boolean(channel.isLocked),
    allowRecording: channel.allowRecording !== false,
    createdAt: channel.createdAt || fallback.createdAt || now,
    updatedAt: channel.updatedAt || fallback.updatedAt || now,
  };
}

export function canAccessVoiceChannel(channel, user, workspace, teams = []) {
  if (!channel || !user || !workspace) return false;
  const normalized = normalizeVoiceChannel(channel);
  const member = workspace.members?.find((item) => item.userId === user.id);
  if (!member) return false;
  if (member.role === 'OWNER' || member.role === 'VICE_ADMIN') return true;
  if ((normalized.deniedUserIds || []).includes(user.id)) return false;
  if (normalized.scope === 'WORKSPACE') return true;

  const userTeamIds = getUserTeamIds(user.id, teams);
  if ((normalized.allowedUserIds || []).includes(user.id)) return true;
  if (normalized.teamId && userTeamIds.includes(normalized.teamId)) return true;
  if ((normalized.allowedTeamIds || []).some((teamId) => userTeamIds.includes(teamId))) return true;

  if (member.role === 'MANAGER') {
    return teams.some((team) => {
      const allowed = normalized.teamId === team.id || (normalized.allowedTeamIds || []).includes(team.id);
      return allowed && team.managerId === user.id;
    });
  }

  return false;
}

export function canRecordVoiceChannel(channel, user, workspace, teams = [], permissions = []) {
  if (!channel || !user || !workspace) return false;
  const normalized = normalizeVoiceChannel(channel);
  const member = workspace.members?.find((item) => item.userId === user.id);
  if (!member) return false;
  if (member.role !== 'OWNER' && normalized.allowRecording === false) return false;
  if (member.role === 'OWNER' || member.role === 'VICE_ADMIN') return true;
  if (!canAccessVoiceChannel(normalized, user, workspace, teams)) return false;

  const userTeamIds = getUserTeamIds(user.id, teams);
  const canManageAllowedTeam = teams.some((team) => {
    const allowed = normalized.teamId === team.id || (normalized.allowedTeamIds || []).includes(team.id);
    return allowed && team.managerId === user.id;
  });

  if (member.role === 'MANAGER') {
    return canManageAllowedTeam || (normalized.allowedUserIds || []).includes(user.id) || permissions.includes('voice.record');
  }

  return permissions.includes('voice.record');
}

export function getUserTeamIds(userId, teams = []) {
  return teams.filter((team) => (team.memberIds || []).includes(userId)).map((team) => team.id);
}

export function sanitizeVoiceFileName(name = 'voice-recording.webm') {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
