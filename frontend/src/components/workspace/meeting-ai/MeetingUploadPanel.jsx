import { useCallback, useMemo, useRef, useState } from 'react';
import { FiAlertTriangle, FiDollarSign, FiFileText, FiLoader, FiUploadCloud, FiX, FiZap } from 'react-icons/fi';
import {
  MAX_AI_AUDIO_SIZE_BYTES,
  WARNING_AI_AUDIO_SIZE_BYTES,
} from '@/domain/constants/costConstants';
import { computeFileHash, checkFileExists } from '@/services/storageService';

const sampleTranscript = `Sarah: We need to finish the AI meeting flow this week. John will prepare the API contract by Friday. Alex should review the task extraction experience. The team agreed that AI can suggest tasks, but managers must approve them before task creation.`;
const MAX_FILE_SIZE = MAX_AI_AUDIO_SIZE_BYTES; // 400 MB
const ALLOWED_EXTENSIONS = /\.(mp3|wav|m4a|ogg|webm|txt|vtt|srt)$/i;
const ALLOWED_MIME_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav',
  'audio/mp4', 'audio/m4a', 'audio/ogg', 'audio/webm', 'text/plain', 'text/vtt',
];

export default function MeetingUploadPanel({
  workspaceTeams,
  workspaceMembers,
  canManageMeetings,
  onAnalyze,
  processing,
}) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [fileSizeWarning, setFileSizeWarning] = useState('');
  const [form, setForm] = useState({
    title: 'Sprint Planning Meeting',
    teamId: workspaceTeams[0]?.id || '',
    type: 'TRANSCRIPT',
    transcript: sampleTranscript,
    participantIds: workspaceMembers.slice(0, 3).map((member) => member.userId),
  });

  const participantOptions = useMemo(() => {
    const team = workspaceTeams.find((item) => item.id === form.teamId);
    if (!team) return workspaceMembers;
    return workspaceMembers.filter((member) => team.memberIds?.includes(member.userId));
  }, [workspaceTeams, workspaceMembers, form.teamId]);

  const toggleParticipant = (userId) => {
    setForm((prev) => ({
      ...prev,
      participantIds: prev.participantIds.includes(userId)
        ? prev.participantIds.filter((id) => id !== userId)
        : [...prev.participantIds, userId],
    }));
  };

  const submit = (event) => {
    event.preventDefault();
    onAnalyze({
      ...form,
      fileName: file?.name || null,
      file,
      audioHash: fileHash || null,
      type: file ? 'AUDIO' : form.type,
    });
  };

  const selectFile = useCallback(async (selected) => {
    if (!selected) return;

    if (!isAllowedFile(selected)) {
      setFile(null);
      setFileHash('');
      setFileError('Only MP3, WAV, M4A, WebM audio or TXT, VTT, SRT transcript files are allowed.');
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFile(null);
      setFileHash('');
      setFileError(`File is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB.`);
      return;
    }

    setFile(selected);
    setFileError('');
    setDuplicateWarning('');
    setFileSizeWarning('');

    // Show size warning for large files (>= 350MB)
    if (selected.size >= WARNING_AI_AUDIO_SIZE_BYTES) {
      const sizeMB = Math.round(selected.size / (1024 * 1024));
      setFileSizeWarning(`Large file (${sizeMB} MB) — AI processing may incur higher cost.`);
    }

    // Check for duplicate files using hash
    try {
      const hash = await computeFileHash(selected);
      setFileHash(hash);
      if (hash) {
        const exists = await checkFileExists(hash);
        if (exists.exists) {
          setDuplicateWarning('This file appears to have been uploaded before. Check the meeting history to avoid duplicates.');
        }
      }
    } catch {
      // Silently ignore hash failures
    }
  }, []);

  const handleFileChange = async (event) => {
    await selectFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragging(false);
    await selectFile(event.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    setFileHash('');
    setFileError('');
    setDuplicateWarning('');
    setFileSizeWarning('');
  };

  const fileSizeMB = file ? Math.round(file.size / (1024 * 1024)) : 0;
  const isLargeFile = fileSizeMB > (WARNING_AI_AUDIO_SIZE_BYTES / (1024 * 1024));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">Input</p>
        <h2 className="text-lg font-black text-slate-950">Upload meeting</h2>
      </div>

      {!canManageMeetings ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
          Only Owner, Vice Admin, or Manager can analyze meetings.
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Meeting title">
            <input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
              required
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Team">
              <select
                value={form.teamId}
                onChange={(event) => setForm((prev) => ({ ...prev, teamId: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
              >
                <option value="">Workspace-wide</option>
                {workspaceTeams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Meeting type">
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-blue-400"
              >
                <option value="TRANSCRIPT">Transcript</option>
                <option value="AUDIO">Audio</option>
              </select>
            </Field>
          </div>

          <Field label="Audio file">
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,.mp3,.wav,.m4a,.ogg,.webm,text/plain,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border border-dashed px-4 py-4 text-center transition ${
                isDragging
                  ? 'border-blue-400 bg-blue-50 ring-4 ring-blue-100'
                  : isLargeFile
                  ? 'border-amber-300 bg-amber-50 hover:border-amber-400 hover:bg-amber-100'
                  : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {file ? (
                <FiFileText className={`h-7 w-7 ${isLargeFile ? 'text-amber-500' : 'text-blue-500'}`} />
              ) : (
                <FiUploadCloud className={`h-7 w-7 ${isLargeFile ? 'text-amber-500' : 'text-blue-500'}`} />
              )}
              <span className="mt-2 text-sm font-black text-slate-700">
                {file ? file.name : isDragging ? 'Drop file to attach' : 'Drag and drop audio or transcript'}
              </span>
              <span className="mt-1 text-xs font-medium text-slate-400">
                MP3, WAV, M4A, WebM, TXT, VTT, SRT. Max {Math.round(MAX_FILE_SIZE / (1024 * 1024))} MB.
              </span>
            </button>
            {file ? (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                <span className="truncate">{fileSizeMB || '<1'} MB {fileHash ? `- hash ${fileHash.slice(0, 8)}` : ''}</span>
                <button type="button" onClick={clearFile} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-700">
                  <FiX className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {fileError && <p className="mt-2 text-xs font-bold text-red-600">{fileError}</p>}
            {duplicateWarning && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <FiAlertTriangle className="h-3.5 w-3.5" />
                {duplicateWarning}
              </p>
            )}
            {fileSizeWarning && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <FiDollarSign className="h-3.5 w-3.5" />
                {fileSizeWarning}
              </p>
            )}
          </Field>

          <Field label="Transcript">
            <textarea
              value={form.transcript}
              onChange={(event) => setForm((prev) => ({ ...prev, transcript: event.target.value }))}
              rows={6}
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm leading-6 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </Field>

          <Field label={`Participants (${form.participantIds.length})`}>
            <div className="grid gap-2">
              {participantOptions.map((member) => {
                const selected = form.participantIds.includes(member.userId);
                return (
                  <button
                    key={member.userId}
                    type="button"
                    onClick={() => toggleParticipant(member.userId)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-bold transition ${
                      selected
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{member.name || member.nickname || 'Unknown'}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          <button
            type="submit"
            disabled={processing || !form.title.trim()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {processing ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiZap className="h-4 w-4" />}
            {processing ? 'Analyzing...' : 'Analyze with AI'}
          </button>
        </form>
      )}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function isAllowedFile(file) {
  if (!file) return false;
  const typeAllowed = !file.type || ALLOWED_MIME_TYPES.includes(file.type);
  return typeAllowed && ALLOWED_EXTENSIONS.test(file.name || '');
}
