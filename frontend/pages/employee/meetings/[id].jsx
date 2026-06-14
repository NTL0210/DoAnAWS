import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiUser,
} from 'react-icons/fi';
import { StatusPill } from '../../../src/components/layout/AppShell';
import { getMeetings } from '../../../src/services/legacyDataService';

export default function EmployeeMeetingDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const meetings = await getMeetings();
      const found = meetings.find((m) => m.id === id);
      await new Promise((r) => setTimeout(r, 400));
      setMeeting(found || null);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef3f8]">
        <FiLoader className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#eef3f8] gap-4">
        <p className="text-lg font-bold text-slate-700">Meeting not found</p>
        <button onClick={() => router.back()} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      {/* Top bar */}
      <div className="topbar-glass sticky top-0 z-20 border-b border-slate-200/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50">
              <FiArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-xs font-semibold text-primary-600">Employee view</p>
              <h1 className="text-lg font-bold text-slate-900">{meeting.title}</h1>
            </div>
          </div>
          <Link href="/employee/meetings" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            All meetings
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Meeting info */}
          <div className="rounded-lg border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{meeting.title}</h2>
                <p className="mt-2 text-sm text-slate-500">
                  {meeting.departmentId === 'dept-1' ? 'Frontend Team' :
                   meeting.departmentId === 'dept-2' ? 'Backend Team' :
                   meeting.departmentId === 'dept-3' ? 'AI Team' : 'DevOps Team'}
                </p>
              </div>
              <StatusPill tone={statusTone(meeting.status)}>{meeting.status}</StatusPill>
            </div>
            <div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2">
                <FiCalendar className="h-4 w-4" />
                {new Date(meeting.createdAt).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-2">
                <FiUser className="h-4 w-4" />
                {meeting.uploadedBy === 'emp-2' ? 'Sarah Chen' : 'Manager'}
              </span>
              <span className="inline-flex items-center gap-2">
                <FiFileText className="h-4 w-4" />
                {meeting.audioUrl ? 'Audio' : 'Transcript'}
              </span>
            </div>
          </div>

          {/* Summary */}
          {meeting.summary && (
            <div className="rounded-lg border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-3">AI Summary</h3>
              <p className="text-sm leading-7 text-slate-600">{meeting.summary}</p>
            </div>
          )}

          {/* Transcript */}
          {meeting.transcriptText && (
            <div className="rounded-lg border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-3">Transcript</h3>
              <p className="text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                {showFullTranscript ? meeting.transcriptText : meeting.transcriptText.slice(0, 4000)}
              </p>
              {!showFullTranscript && meeting.transcriptText.length > 4000 && (
                <button
                  type="button"
                  onClick={() => setShowFullTranscript(true)}
                  className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Load full transcript
                </button>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function statusTone(s) {
  if (s === 'COMPLETED') return 'green';
  if (s === 'PROCESSING') return 'amber';
  if (s === 'FAILED') return 'red';
  return 'blue';
}
