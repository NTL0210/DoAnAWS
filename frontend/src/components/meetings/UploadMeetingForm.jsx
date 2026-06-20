import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiFileText,
  FiLoader,
  FiMic,
  FiUploadCloud,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { getDepartments, getUsers, getMockAI } from '../../services/legacyDataService';

const sampleTranscript = `Sarah: We need to finish the manager dashboard upload flow this week. John will implement the audio upload UI by June 5. Jane should polish the transcript review screen by June 6. Michael needs to prepare the API contract for meeting processing by June 7. The team agreed that AI should summarize the meeting, extract tasks, assign owners, and show deadlines on the dashboard.`;

const processingSteps = [
  'Uploading meeting file',
  'Transcribing audio',
  'Summarizing meeting',
  'Extracting action items',
  'Assigning tasks',
];

export default function UploadMeetingForm() {
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({
    title: 'Sprint Planning Meeting',
    departmentId: 'dept-1',
    transcript: sampleTranscript,
    participantIds: ['emp-2', 'emp-3', 'emp-4'],
  });
  const [audioFile, setAudioFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMockData = async () => {
      const [departmentData, userData] = await Promise.all([
        getDepartments(), getUsers()
      ]);
      setDepartments(departmentData);
      setUsers(userData);
    };

    loadMockData();
  }, []);

  const departmentUsers = useMemo(() => {
    return users.filter((user) => user.departmentId === formData.departmentId || user.role === 'MANAGER');
  }, [formData.departmentId, users]);

  const participants = useMemo(() => {
    return users.filter((user) => formData.participantIds.includes(user.id));
  }, [formData.participantIds, users]);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setError('Please upload an audio file such as MP3, WAV, or M4A.');
      return;
    }

    setAudioFile(file);
    setError('');
  };

  const toggleParticipant = (userId) => {
    setFormData((current) => {
      const exists = current.participantIds.includes(userId);
      return {
        ...current,
        participantIds: exists
          ? current.participantIds.filter((id) => id !== userId)
          : [...current.participantIds, userId],
      };
    });
  };

  const processMeeting = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!formData.title.trim()) {
      setError('Meeting title is required.');
      return;
    }

    if (!audioFile && !formData.transcript.trim()) {
      setError('Upload an audio file or paste a transcript before processing.');
      return;
    }

    if (participants.length === 0) {
      setError('Select at least one participant so AI can assign tasks.');
      return;
    }

    setProcessing(true);
    setActiveStep(0);

    for (let index = 0; index < processingSteps.length; index += 1) {
      setActiveStep(index);
      await new Promise((resolve) => setTimeout(resolve, 550));
    }

    const transcript = formData.transcript.trim() || buildMockTranscriptFromAudio(audioFile, participants);
    const mockAI = await getMockAI();
    const aiResult = await mockAI.processMeeting({ transcript, participants });

    setResult({
      meeting: {
        title: formData.title,
        departmentId: formData.departmentId,
        audioFileName: audioFile?.name,
        transcript,
        summary: aiResult.summary,
      },
      keyDiscussionPoints: aiResult.keyDiscussionPoints || [],
      tasks: aiResult.tasks,
    });

    setProcessing(false);
    setActiveStep(-1);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <motion.form
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={processMeeting}
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-sm backdrop-blur"
      >
        <div className="mb-6">
          <p className="text-sm font-semibold text-primary-600">Meeting input</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-slate-100">Upload audio or transcript</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Demo flow: upload MP3/WAV/M4A or paste transcript, then mock AI will summarize and extract tasks.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            <FiAlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Meeting title</label>
            <input
              value={formData.title}
              onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Department</label>
            <select
              value={formData.departmentId}
              onChange={(event) => setFormData((current) => ({ ...current, departmentId: event.target.value, participantIds: [] }))}
              className="h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 text-sm outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Audio file</label>
            <label className="group relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-5 py-6 text-center transition hover:-translate-y-1 hover:border-primary-400 hover:bg-primary-50/40 hover:shadow-lg hover:shadow-blue-100">
              <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/70 to-transparent transition duration-700 group-hover:translate-x-[120%]" />
              <FiUploadCloud className="relative h-9 w-9 text-primary-600 transition group-hover:scale-110" />
              <span className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {audioFile ? audioFile.name : 'Drop or choose MP3/WAV/M4A'}
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Audio is mocked locally. Real AWS flow would upload to S3 then Transcribe.
              </span>
              <input type="file" accept="audio/*,.mp3,.wav,.m4a" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Transcript</label>
            <textarea
              value={formData.transcript}
              onChange={(event) => setFormData((current) => ({ ...current, transcript: event.target.value }))}
              rows={8}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-3 text-sm leading-6 outline-none transition focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
              placeholder="Paste meeting transcript here..."
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Participants</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {departmentUsers.map((participant) => {
                const selected = formData.participantIds.includes(participant.id);
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => toggleParticipant(participant.id)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                      selected ? 'border-primary-200 bg-primary-50 text-primary-700' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <img src={participant.avatar} alt={participant.name} className="h-8 w-8 rounded-full object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{participant.name}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{participant.role}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={processing}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiZap className="h-4 w-4" />}
          {processing ? 'Processing with AI...' : 'Process with AI'}
        </button>
      </motion.form>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 p-6 shadow-sm backdrop-blur"
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-600">AI output</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-slate-100">Summary and tasks</h2>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <FiMic className="h-5 w-5" />
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-5">
          {processingSteps.map((step, index) => (
            <div
              key={step}
              className={`rounded-xl border px-3 py-3 text-center text-xs font-semibold transition ${
                activeStep === index
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : activeStep > index
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              {activeStep > index ? <FiCheckCircle className="mx-auto mb-2 h-4 w-4" /> : <FiLoader className={`mx-auto mb-2 h-4 w-4 ${activeStep === index ? 'animate-spin' : ''}`} />}
              {step}
            </div>
          ))}
        </div>

        {!result && !processing && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-10 text-center">
            <FiFileText className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500" />
            <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">No AI result yet</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Submit a meeting to see summary, discussion points, extracted tasks, owners, priorities, and deadlines.
            </p>
          </div>
        )}

        {processing && (
          <div className="dashboard-shimmer rounded-2xl bg-slate-950 p-6 text-white">
            <div className="flex items-center gap-3">
              <FiLoader className="h-5 w-5 animate-spin text-cyan-300" />
              <span className="font-semibold">{processingSteps[activeStep] || 'Processing'}</span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                animate={{ width: `${((activeStep + 1) / processingSteps.length) * 100}%` }}
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
              />
            </div>
          </div>
        )}

        {result && !processing && (
          <div className="space-y-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="dashboard-shimmer rounded-2xl bg-slate-950 p-5 text-white"
            >
              <p className="text-sm text-slate-300">{result.meeting.title}</p>
              <h3 className="mt-2 text-xl font-bold">Meeting Summary</h3>
              <p className="mt-3 text-sm leading-6 text-slate-200">{result.meeting.summary}</p>
            </motion.div>

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key discussion points</h3>
              <div className="space-y-2">
                {result.keyDiscussionPoints.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-xl bg-slate-50 dark:bg-slate-800 px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                    <FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {point}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Extracted tasks ({result.tasks.length})
              </h3>
              <div className="space-y-3">
                {result.tasks.map((task, index) => (
                  <motion.div
                    key={`${task.title}-${index}`}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-bold text-slate-950 dark:text-slate-100">{task.title}</h4>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{task.description}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${getPriorityClass(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1">
                        <FiUsers className="mr-1 inline h-3.5 w-3.5" />
                        {typeof task.assignee === 'string' ? task.assignee : task.assignee?.name || 'Unassigned'}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1">
                        Deadline: {task.deadline || 'AI suggested'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.section>
    </div>
  );
}

function buildMockTranscriptFromAudio(file, participants) {
  const names = participants.map((participant) => participant.name).join(', ');
  return `${names} discussed project progress from audio file ${file?.name || 'meeting-audio.mp3'}. Sarah will review the sprint scope by next Monday. John needs to implement the upload UI. Jane should test the AI summary result. The manager will track deadlines on the dashboard.`;
}

function getPriorityClass(priority) {
  switch (priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-700';
    case 'HIGH':
      return 'bg-orange-100 text-orange-700';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-emerald-100 text-emerald-700';
  }
}
