'use client';

import { FiWifi, FiWifiOff } from 'react-icons/fi';

export function getNetworkQuality(latencyMs, connected) {
  if (!connected) return { key: 'disconnected', label: 'Disconnected', tone: 'gray' };
  if (latencyMs === null || latencyMs === undefined || latencyMs <= 0) return { key: 'measuring', label: 'Measuring', tone: 'gray' };
  if (latencyMs <= 80) return { key: 'good', label: 'Good', tone: 'green' };
  if (latencyMs <= 180) return { key: 'medium', label: 'Medium', tone: 'yellow' };
  return { key: 'poor', label: 'Poor', tone: 'red' };
}

export default function NetworkStatusBadge({
  latencyMs = null,
  connected = false,
  compact = false,
  showText = true,
  label = 'Voice ping',
}) {
  const quality = getNetworkQuality(latencyMs, connected);
  const hasLatency = latencyMs !== null && latencyMs !== undefined && latencyMs > 0;
  const title = !connected
    ? 'Voice server disconnected'
    : hasLatency
      ? `${label}: ${latencyMs}ms - ${quality.label}`
      : 'Measuring voice ping...';
  const colorClass = {
    green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-500',
    blue: 'bg-blue-50 text-blue-500',
    gray: 'bg-slate-100 text-slate-500',
  }[quality.tone];
  const dotClass = {
    green: 'bg-emerald-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    gray: 'bg-slate-400',
  }[quality.tone];

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass}`}
    >
      {connected ? <FiWifi className="h-3 w-3" /> : <FiWifiOff className="h-3 w-3" />}
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {showText ? <span>{hasLatency ? `${latencyMs}ms` : compact ? '...' : quality.label}</span> : null}
    </span>
  );
}
