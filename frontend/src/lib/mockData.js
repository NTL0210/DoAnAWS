// Mock data for the AI Meeting Workforce Platform

// Departments
export const departments = [
  {
    id: 'dept-1',
    name: 'Frontend Team',
    managerId: 'emp-2',
    memberIds: ['emp-1', 'emp-2', 'emp-3', 'emp-4'],
    createdAt: '2026-01-15',
    updatedAt: '2026-05-01'
  },
  {
    id: 'dept-2',
    name: 'Backend Team',
    managerId: 'emp-5',
    memberIds: ['emp-5', 'emp-6', 'emp-7', 'emp-8'],
    createdAt: '2026-01-15',
    updatedAt: '2026-05-01'
  },
  {
    id: 'dept-3',
    name: 'AI Team',
    managerId: 'emp-9',
    memberIds: ['emp-9', 'emp-10'],
    createdAt: '2026-03-01',
    updatedAt: '2026-05-01'
  },
  {
    id: 'dept-4',
    name: 'DevOps Team',
    managerId: 'emp-11',
    memberIds: ['emp-11', 'emp-12'],
    createdAt: '2026-02-01',
    updatedAt: '2026-05-01'
  }
];

// Employees/Users
export const users = [
  // Admin
  {
    id: 'emp-1',
    name: 'Alex Johnson',
    email: 'alex@company.com',
    role: 'ADMIN',
    departmentId: null,
    status: 'ACTIVE',
    createdAt: '2026-01-10',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=1'
  },
  // Managers
  {
    id: 'emp-2',
    name: 'Sarah Chen',
    email: 'sarah@company.com',
    role: 'MANAGER',
    departmentId: 'dept-1',
    status: 'ACTIVE',
    createdAt: '2026-01-12',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=2'
  },
  {
    id: 'emp-5',
    name: 'Michael Rodriguez',
    email: 'michael@company.com',
    role: 'MANAGER',
    departmentId: 'dept-2',
    status: 'ACTIVE',
    createdAt: '2026-01-12',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=5'
  },
  {
    id: 'emp-9',
    name: 'David Kim',
    email: 'david@company.com',
    role: 'MANAGER',
    departmentId: 'dept-3',
    status: 'ACTIVE',
    createdAt: '2026-03-05',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=9'
  },
  {
    id: 'emp-11',
    name: 'Lisa Wang',
    email: 'lisa@company.com',
    role: 'MANAGER',
    departmentId: 'dept-4',
    status: 'ACTIVE',
    createdAt: '2026-02-05',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=11'
  },
  // Employees
  {
    id: 'emp-3',
    name: 'John Doe',
    email: 'john@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-1',
    status: 'ACTIVE',
    createdAt: '2026-01-15',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=3'
  },
  {
    id: 'emp-4',
    name: 'Jane Smith',
    email: 'jane@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-1',
    status: 'ACTIVE',
    createdAt: '2026-01-16',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=4'
  },
  {
    id: 'emp-6',
    name: 'Robert Taylor',
    email: 'robert@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-2',
    status: 'ACTIVE',
    createdAt: '2026-01-18',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=6'
  },
  {
    id: 'emp-7',
    name: 'Emily Davis',
    email: 'emily@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-2',
    status: 'ACTIVE',
    createdAt: '2026-01-20',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=7'
  },
  {
    id: 'emp-8',
    name: 'James Wilson',
    email: 'james@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-2',
    status: 'ACTIVE',
    createdAt: '2026-01-22',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=8'
  },
  {
    id: 'emp-10',
    name: 'Anna Lopez',
    email: 'anna@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-3',
    status: 'ACTIVE',
    createdAt: '2026-03-10',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=10'
  },
  {
    id: 'emp-12',
    name: 'Kevin O\'Neil',
    email: 'kevin@company.com',
    role: 'EMPLOYEE',
    departmentId: 'dept-4',
    status: 'ACTIVE',
    createdAt: '2026-02-10',
    updatedAt: '2026-05-01',
    avatar: 'https://i.pravatar.cc/150?img=12'
  }
];

// Meetings
export const meetings = [
  {
    id: 'meet-1',
    title: 'Weekly Sync - Frontend Team',
    departmentId: 'dept-1',
    uploadedBy: 'emp-2',
    transcriptText: 'Team discussed the upcoming sprint goals for the login page implementation. Sarah mentioned we need to focus on responsive design and accessibility. John volunteered to work on the form validation. Jane will handle the UI components. We decided to use React Hook Form for validation and Chakra UI for components. Deadline for MVP is June 15th. Action items: John - implement form validation by June 5th; Jane - create reusable input components by June 3rd; Sarah - review designs with product team by June 1st.',
    audioUrl: null,
    summary: 'Frontend team sync focused on login page implementation for upcoming sprint. Decided on tech stack (React Hook Form + Chakra UI) and assigned specific tasks for form validation and UI components.',
    status: 'COMPLETED',
    createdAt: '2026-05-20',
    updatedAt: '2026-05-25'
  },
  {
    id: 'meet-2',
    title: 'API Architecture Review',
    departmentId: 'dept-2',
    uploadedBy: 'emp-5',
    transcriptText: 'Backend team reviewed the current API architecture for the meeting platform. Michael pointed out scalability concerns with the current monolith approach. Robert suggested migrating to microservices. Emily will research AWS Lambda options. James will look into API Gateway configurations. We agreed to prototype a microservice for task management by end of month.',
    audioUrl: null,
    summary: 'Backend team reviewed API architecture and agreed to migrate toward microservices for better scalability. Assigned research tasks for AWS solutions.',
    status: 'COMPLETED',
    createdAt: '2026-05-18',
    updatedAt: '2026-05-22'
  },
  {
    id: 'meet-3',
    title: 'AI Model Selection Meeting',
    departmentId: 'dept-3',
    uploadedBy: 'emp-9',
    transcriptText: 'AI team meeting to select appropriate models for meeting summarization and task extraction. David compared OpenAI GPT-4 vs Anthropic Claude 3 vs AWS Bedrock options. Anna presented cost analysis showing Bedrock might be more cost-effective for high volume. We decided to prototype with OpenAI first for better quality, then evaluate Bedrock for scaling.',
    audioUrl: null,
    summary: 'AI team evaluated different models for meeting processing and selected OpenAI GPT-4 for initial implementation due to superior quality, with plans to evaluate AWS Bedrock for cost optimization at scale.',
    status: 'COMPLETED',
    createdAt: '2026-05-15',
    updatedAt: '2026-05-20'
  },
  {
    id: 'meet-4',
    title: 'Infrastructure Planning',
    departmentId: 'dept-4',
    uploadedBy: 'emp-11',
    transcriptText: 'DevOps team planning AWS infrastructure for the meeting platform. Lisa outlined the proposed architecture: S3 for storage, Lambda for processing, DynamoDB for storage, API Gateway for endpoints. Kevin will set up IAM roles and policies. We need to ensure HIPAA compliance for potential healthcare clients.',
    audioUrl: null,
    summary: 'DevOps team designed AWS infrastructure architecture using S3, Lambda, DynamoDB, and API Gateway. Assigned tasks for security setup and compliance review.',
    status: 'COMPLETED',
    createdAt: '2026-05-10',
    updatedAt: '2026-05-15'
  },
  {
    id: 'meet-5',
    title: 'Q3 Planning Symposium',
    departmentId: 'dept-1',
    uploadedBy: 'emp-2',
    transcriptText: '',
    audioUrl: null,
    summary: 'AI is processing this meeting transcript...',
    status: 'PROCESSING',
    createdAt: '2026-05-30',
    updatedAt: '2026-05-30'
  }
];

// Tasks
export const tasks = [
  {
    id: 'task-1',
    meetingId: 'meet-1',
    departmentId: 'dept-1',
    title: 'Implement form validation for login page',
    description: 'Create reusable form validation components using React Hook Form with proper error handling and accessibility features',
    assigneeId: 'emp-3',
    createdBy: 'emp-2',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    progress: 60,
    deadline: '2026-06-05',
    createdAt: '2026-05-21',
    updatedAt: '2026-05-28'
  },
  {
    id: 'task-2',
    meetingId: 'meet-1',
    departmentId: 'dept-1',
    title: 'Create reusable input components',
    description: 'Build a library of accessible, reusable input components using Chakra UI that follow our design system',
    assigneeId: 'emp-4',
    createdBy: 'emp-2',
    priority: 'MEDIUM',
    status: 'PENDING',
    progress: 0,
    deadline: '2026-06-03',
    createdAt: '2026-05-21',
    updatedAt: '2026-05-21'
  },
  {
    id: 'task-3',
    meetingId: 'meet-1',
    departmentId: 'dept-1',
    title: 'Review designs with product team',
    description: 'Meet with product team to review and finalize login page designs before implementation begins',
    assigneeId: 'emp-2',
    createdBy: 'emp-2',
    priority: 'MEDIUM',
    status: 'COMPLETED',
    progress: 100,
    deadline: '2026-06-01',
    createdAt: '2026-05-21',
    updatedAt: '2026-05-25'
  },
  {
    id: 'task-4',
    meetingId: 'meet-2',
    departmentId: 'dept-2',
    title: 'Research AWS Lambda options for task processing',
    description: 'Investigate AWS Lambda implementation options for handling task creation and updates, including cold start concerns and pricing models',
    assigneeId: 'emp-6',
    createdBy: 'emp-5',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    progress: 40,
    deadline: '2026-06-10',
    createdAt: '2026-05-19',
    updatedAt: '2026-05-25'
  },
  {
    id: 'task-5',
    meetingId: 'meet-2',
    departmentId: 'dept-2',
    title: 'Evaluate API Gateway configurations',
    description: 'Review different API Gateway setups for optimal performance and security, including throttling and caching options',
    assigneeId: 'emp-8',
    createdBy: 'emp-5',
    priority: 'MEDIUM',
    status: 'PENDING',
    progress: 0,
    deadline: '2026-06-15',
    createdAt: '2026-05-19',
    updatedAt: '2026-05-19'
  },
  {
    id: 'task-6',
    meetingId: 'meet-3',
    departmentId: 'dept-3',
    title: 'Prototype meeting summarization with OpenAI GPT-4',
    description: 'Create a prototype service that uses OpenAI GPT-4 to generate meeting summaries from transcripts',
    assigneeId: 'emp-9',
    createdBy: 'emp-9',
    priority: 'HIGH',
    status: 'COMPLETED',
    progress: 100,
    deadline: '2026-05-25',
    createdAt: '2026-05-16',
    updatedAt: '2026-05-25'
  },
  {
    id: 'task-7',
    meetingId: 'meet-3',
    departmentId: 'dept-3',
    title: 'Evaluate AWS Bedrock for cost optimization',
    description: 'Research AWS Bedrock as a potential alternative to OpenAI for better cost control at scale',
    assigneeId: 'emp-10',
    createdBy: 'emp-9',
    priority: 'MEDIUM',
    status: 'PENDING',
    progress: 0,
    deadline: '2026-06-05',
    createdAt: '2026-05-16',
    updatedAt: '2026-05-16'
  },
  {
    id: 'task-8',
    meetingId: 'meet-4',
    departmentId: 'dept-4',
    title: 'Set up IAM roles and policies',
    description: 'Create necessary IAM roles and policies for least privilege access to AWS resources',
    assigneeId: 'emp-12',
    createdBy: 'emp-11',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    progress: 30,
    deadline: '2026-05-31',
    createdAt: '2026-05-11',
    updatedAt: '2026-05-28'
  },
  {
    id: 'task-9',
    meetingId: 'meet-4',
    departmentId: 'dept-4',
    title: 'Review HIPAA compliance requirements',
    description: 'Investigate what changes would be needed to make the platform HIPAA compliant for healthcare clients',
    assigneeId: 'emp-11',
    createdBy: 'emp-11',
    priority: 'MEDIUM',
    status: 'PENDING',
    progress: 0,
    deadline: '2026-06-10',
    createdAt: '2026-05-11',
    updatedAt: '2026-05-11'
  },
  {
    id: 'task-10',
    meetingId: 'meet-5',
    departmentId: 'dept-1',
    title: 'Draft Q3 goals and objectives',
    description: 'Create initial draft of Q3 goals for the frontend team based on company objectives',
    assigneeId: null,
    createdBy: 'emp-2',
    priority: 'HIGH',
    status: 'PENDING',
    progress: 0,
    deadline: '2026-06-05',
    createdAt: '2026-05-30',
    updatedAt: '2026-05-30'
  }
];

// Notifications
export const notifications = [
  {
    id: 'notif-1',
    userId: 'emp-3',
    title: 'New task assigned',
    message: 'You have been assigned a new task: Implement form validation for login page',
    type: 'task_assigned',
    isRead: false,
    createdAt: '2026-05-21T10:30:00Z'
  },
  {
    id: 'notif-2',
    userId: 'emp-4',
    title: 'Task deadline approaching',
    message: 'Your task "Create reusable input components" is due in 2 days',
    type: 'deadline_approaching',
    isRead: true,
    createdAt: '2026-06-01T14:20:00Z'
  },
  {
    id: 'notif-3',
    userId: 'emp-6',
    title: 'Meeting processed',
    message: 'The API Architecture Review meeting has been processed and 2 tasks have been extracted',
    type: 'meeting_processed',
    isRead: false,
    createdAt: '2026-05-22T09:15:00Z'
  }
];

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
