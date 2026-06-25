// Mock data for the AI Meeting Workforce Platform

// Departments — cleared for new user onboarding
export const departments = [];

// Employees/Users — cleared for new user onboarding
export const users = [];

// Meetings — cleared for new user onboarding
export const meetings = [];

// Tasks — cleared for new user onboarding
export const tasks = [];

// Notifications — cleared for new user onboarding
export const notifications = [];

// Mock AI processing functions
export const mockAI = {
  // Simulate processing delay
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // Summarize meeting transcript
  summarizeMeeting: async (transcript) => {
    await mockAI.delay(1500); // Simulate processing time

    // Simple mock summarization - extract first few sentences
    const sentences = transcript.split('.').filter(s => s.trim().length > 0);
    const summary = sentences.slice(0, 2).join('.') + '.';

    return summary || 'Meeting discussed important topics and action items were identified.';
  },

  // Extract tasks from transcript
  extractTasks: async (transcript, participants) => {
    await mockAI.delay(2000); // Simulate processing time

    // Mock task extraction based on common patterns
    const actionPatterns = [
      /(\w+(?:\s+\w+)*)\s+(?:will|should|needs? to|going to)\s+([^.]+)/gi,
      /(?:action item|task):?\s*([^.]+)/gi,
      /(\w+(?:\s+\w+)*)\s+is\s+responsible\s+for\s+([^.]+)/gi
    ];

    const tasks = [];
    let transcriptCopy = transcript;

    // Simple mock - create 2-3 tasks based on transcript length
    const taskCount = Math.min(3, Math.max(2, Math.floor(transcript.length / 100)));

    for (let i = 0; i < taskCount; i++) {
      // Find assignee from participants
      const assignee = participants[Math.floor(Math.random() * participants.length)];

      tasks.push({
        title: `Task ${i + 1} from meeting discussion`,
        description: `Action item extracted from meeting: ${transcript.substring(i * 50, (i + 1) * 50)}...`,
        assignee: assignee.name,
        assigneeId: assignee.id,
        deadline: null, // Would be extracted in real implementation
        priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][Math.floor(Math.random() * 4)],
        confidence: 0.75 + Math.random() * 0.2 // 0.75-0.95
      });
    }

    return tasks;
  },

  // Assign tasks to employees based on workload and skills
  assignTasks: async (tasks, employees) => {
    await mockAI.delay(500);

    // Simple assignment - distribute tasks evenly
    return tasks.map((task, index) => {
      const assignee = employees[index % employees.length];
      return {
        ...task,
        assigneeId: assignee.id,
        assignee: assignee.name
      };
    });
  },

  // Calculate priority based on keywords and context
  calculatePriority: async (task) => {
    await mockAI.delay(300);

    const highPriorityKeywords = ['urgent', 'asap', 'critical', 'blocking', 'security'];
    const mediumPriorityKeywords = ['important', 'soon', 'needed', 'required'];

    const text = (task.title + ' ' + (task.description || '')).toLowerCase();

    if (highPriorityKeywords.some(keyword => text.includes(keyword))) {
      return 'URGENT';
    } else if (mediumPriorityKeywords.some(keyword => text.includes(keyword))) {
      return 'HIGH';
    } else {
      return 'MEDIUM';
    }
  },

  // Main processing function
  processMeeting: async (meetingData) => {
    await mockAI.delay(2000); // Initial processing delay

    const { transcript, participants } = meetingData;

    // Process in stages
    const summary = await mockAI.summarizeMeeting(transcript);
    const extractedTasks = await mockAI.extractTasks(transcript, participants);
    const assignedTasks = await mockAI.assignTasks(extractedTasks, participants);

    // Add priorities
    const tasksWithPriority = await Promise.all(
      assignedTasks.map(async (task) => ({
        ...task,
        priority: await mockAI.calculatePriority(task)
      }))
    );

    return {
      summary,
      tasks: tasksWithPriority
    };
  }
};

export default {
  departments,
  users,
  meetings,
  tasks,
  notifications,
  mockAI
};
