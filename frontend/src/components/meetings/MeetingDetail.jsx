import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { FiLoader, FiCheckCircle, FiAlertTriangle, FiFileText, FiUsers, FiCalendar, FiClock, FiTag, FiPlus } from 'react-icons/fi';
import { getMeetings, getTasks } from '../../services/legacyDataService';

export default function MeetingDetail() {
  const router = useRouter();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const meetingId = router.query.id;
  const transcriptLines = useMemo(() => {
    const text = meeting?.transcriptText;
    if (!text) return [];
    return text.split('\n');
  }, [meeting?.transcriptText]);
  const visibleTranscriptLines = showFullTranscript ? transcriptLines : transcriptLines.slice(0, 80);

  // Load meeting data
  useEffect(() => {
    const loadMeeting = async () => {
      if (!meetingId) return;

      setLoading(true);
      setError(null);

      try {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 800));

        // Get mock data
        const allMeetings = await getMeetings();
        const meetingData = allMeetings.find(m => m.id === meetingId);

        if (!meetingData) {
          throw new Error('Meeting not found');
        }

        setMeeting(meetingData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadMeeting();
  }, [meetingId]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'UPLOADED': return 'bg-blue-100 text-blue-800';
      case 'PROCESSING': return 'bg-yellow-100 text-yellow-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'URGENT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <FiLoader className="h-8 w-8 text-primary-500 dark:text-primary-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Loading meeting details...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mx-auto max-w-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <FiAlertTriangle className="h-5 w-5 text-red-500 dark:text-red-400" />
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error Loading Meeting</h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{error}</p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!meeting) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-300">Meeting not found</p>
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Get participants names (mock implementation)
  const getParticipantNames = () => {
    // In a real app, this would fetch user details
    return meeting.participants?.map(p => p.name) || ['John Doe', 'Jane Smith'];
  };

  // Get related tasks for this meeting
  const getRelatedTasks = async () => {
    try {
      const allTasks = await getTasks();
      return allTasks.filter(task => task.meetingId === meeting.id);
    } catch (error) {
      console.error('Error fetching related tasks:', error);
      return [];
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <FiLoader className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {meeting.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {meeting.departmentId === 'dept-1' ? 'Frontend Team' :
                 meeting.departmentId === 'dept-2' ? 'Backend Team' :
                 meeting.departmentId === 'dept-3' ? 'AI Team' : 'DevOps Team'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(meeting.status)}`}>
              {meeting.status}
            </span>
            <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
              {new Date(meeting.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Meeting Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Meeting Information
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Department
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {meeting.departmentId === 'dept-1' ? 'Frontend Team' :
                   meeting.departmentId === 'dept-2' ? 'Backend Team' :
                   meeting.departmentId === 'dept-3' ? 'AI Team' : 'DevOps Team'}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Date & Time
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {new Date(meeting.createdAt).toLocaleString()}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Uploaded By
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {meeting.uploadedBy === 'emp-2' ? 'Sarah Chen' :
                   meeting.uploadedBy === 'emp-5' ? 'Michael Rodriguez' :
                   meeting.uploadedBy === 'emp-9' ? 'David Kim' : 'Lisa Wang'}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Format
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {meeting.audioUrl ? 'Audio File' : 'Transcript'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Transcript Section (if available) */}
        {meeting.transcriptText && meeting.transcriptText.trim() !== '' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Meeting Transcript
              </h2>
            </div>
            <div className="p-6">
              <div className="max-none text-gray-700 dark:text-gray-200 leading-relaxed">
                {visibleTranscriptLines.map((line, index) => (
                  <p key={index} className="mb-2 last:mb-0 text-gray-700 dark:text-gray-200">{line}</p>
                ))}
                {transcriptLines.length > visibleTranscriptLines.length && (
                  <button
                    type="button"
                    onClick={() => setShowFullTranscript(true)}
                    className="mt-4 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Load full transcript
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Section */}
        {meeting.summary && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                AI Meeting Summary
              </h2>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {meeting.summary}
              </p>
            </div>
          </div>
        )}

        {/* Key Discussion Points Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Key Discussion Points
            </h2>
          </div>
          <div className="p-6">
            {/* In a real app, we would extract these from the transcript */}
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FiLoader className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-600 dark:text-gray-300">
                    Discussed technical approach for implementing the meeting platform
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FiLoader className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-600 dark:text-gray-300">
                    Reviewed UI/UX design requirements and accessibility standards
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FiLoader className="h-4 w-4 text-primary-500 dark:text-primary-400" />
                </div>
                <div className="flex-1">
                  <p className="text-gray-600 dark:text-gray-300">
                    Planned sprint goals and deliverables for Q3
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Extracted Tasks Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Extracted Tasks
              </h2>
              <button
                onClick={() => setEditMode(true)}
                disabled={meeting.status === 'PROCESSING'}
                className={`px-3 py-1.5 text-sm font-medium rounded-md border border-transparent
                  ${meeting.status === 'PROCESSING'
                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                    : 'bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-500'
                  }`}
              >
                {meeting.status === 'PROCESSING' ? 'Processing...' : 'Edit Tasks'}
              </button>
            </div>
          </div>
          <div className="p-6">
            {/* In a real app, we would fetch the actual tasks for this meeting */}
            <div className="space-y-4">
              {/* Mock tasks for this meeting */}
              {[1, 2, 3].map((taskIndex) => (
                <div
                  key={taskIndex}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-l-4
                    border-primary-500 dark:border-primary-400"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      Task {taskIndex}: Implement feature for meeting platform
                    </h4>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${taskIndex === 1 ? 'bg-orange-100 text-orange-800' :
                        taskIndex === 2 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'}`}>
                      {taskIndex === 1 ? 'HIGH' : taskIndex === 2 ? 'MEDIUM' : 'LOW'}
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    This is a sample task description that would be extracted from the meeting transcript.
                    It includes action items and responsibilities for team members.
                  </p>
                  <div className="flex items-start space-x-4 text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-space-x-2">
                      <FiUsers className="h-4 w-4" />
                      <span>Assignee: John Doe</span>
                    </div>
                    <div className="flex items-space-x-2">
                      <FiCalendar className="h-4 w-4" />
                      <span>Due: {new Date(2026, 5, 15 + taskIndex).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end space-x-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Back to Meetings
          </button>
          {meeting.status === 'COMPLETED' && (
            <button
              onClick={() => {
                // In real app, this would regenerate tasks or refresh data
                alert('Would regenerate AI insights for this meeting in real implementation');
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 transition-colors"
            >
              Refresh AI Insights
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
