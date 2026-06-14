import {
  FiUsers,
  FiBriefcase,
  FiUploadCloud,
  FiCheckSquare,
  FiFolder,
  FiMessageSquare,
  FiBarChart2,
} from 'react-icons/fi';

/**
 * Empty state components for various sections of the workspace
 */
export function EmptyTeams({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
        <FiBriefcase className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-black text-slate-900">No teams yet</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        Create your first team to organize members by function or project.
      </p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
        >
          <FiFolder className="h-4 w-4" />
          Create Team
        </button>
      )}
    </div>
  );
}

export function EmptyMembers({ onInvite }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <FiUsers className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-black text-slate-900">No members yet</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        Invite your team members to start collaborating in this workspace.
      </p>
      {onInvite && (
        <button
          type="button"
          onClick={onInvite}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700"
        >
          <FiUsers className="h-4 w-4" />
          Invite Members
        </button>
      )}
    </div>
  );
}

export function EmptyMeetings({ onUpload }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        <FiUploadCloud className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-black text-slate-900">No meetings recorded</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        Upload your first meeting transcript or audio file to let AI extract tasks automatically.
      </p>
      {onUpload && (
        <button
          type="button"
          onClick={onUpload}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-700"
        >
          <FiUploadCloud className="h-4 w-4" />
          Upload Meeting
        </button>
      )}
    </div>
  );
}

export function EmptyTasks({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
        <FiCheckSquare className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-black text-slate-900">No tasks yet</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        Tasks will appear here when AI extracts them from meetings, or you can create one manually.
      </p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-700"
        >
          <FiCheckSquare className="h-4 w-4" />
          Create Task
        </button>
      )}
    </div>
  );
}

export function EmptyChannels({ onCreate }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
        <FiMessageSquare className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-black text-slate-900">No channels</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        Create channels to organize conversations by topic or project.
      </p>
      {onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-700"
        >
          <FiMessageSquare className="h-4 w-4" />
          Create Channel
        </button>
      )}
    </div>
  );
}

export function EmptyAnalytics() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-8 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <FiBarChart2 className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-base font-black text-slate-900">No analytics data</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
        Analytics will populate once you have meetings, tasks, and team activity in this workspace.
      </p>
    </div>
  );
}
