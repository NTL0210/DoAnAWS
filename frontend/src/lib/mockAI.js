// Mock AI Service for simulating AI processing of meetings
// This service will be replaced with real AI integration later

export const mockAI = {
  /**
   * Simulates AI meeting summarization
   * @param {string} transcript - Meeting transcript text
   * @returns {Promise<Object>} - Summary object
   */
  summarizeMeeting: async (transcript) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return a realistic meeting summary based on keywords in transcript
    const summary = {
      summary: "Team discussed project milestones, upcoming deadlines, and resource allocation. Key decisions included approving the new feature scope and assigning ownership for implementation tasks.",
      keyDiscussionPoints: [
        "Review of Q3 project timeline and deliverables",
        "Discussion on technical architecture for new microservice",
        "Resource allocation for frontend and backend teams",
        "Risk assessment for upcoming production deployment",
        "Action items for bug fixes and performance optimization"
      ],
      actionItems: [
        "Prepare detailed technical specification for payment service",
        "Create wireframes for user profile dashboard",
        "Set up CI/CD pipeline for staging environment",
        "Conduct security audit of authentication module",
        "Optimize database queries for reporting dashboard"
      ]
    };

    return summary;
  },

  /**
   * Simulates AI task extraction from meeting transcript
   * @param {string} transcript - Meeting transcript text
   * @param {Array} participants - List of meeting participants
   * @returns {Promise<Array>} - Extracted tasks
   */
  extractTasks: async (transcript, participants) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate realistic tasks based on common meeting topics
    const taskTemplates = [
      {
        title: "Implement user authentication module",
        description: "Create secure login/logout functionality with JWT tokens and refresh token handling",
        priority: "HIGH",
        estimatedHours: 8
      },
      {
        title: "Design database schema for new feature",
        description: "Create ER diagram and define table relationships for the upcoming reporting module",
        priority: "MEDIUM",
        estimatedHours: 6
      },
      {
        title: "Fix API validation bug in user endpoints",
        description: "Resolve validation errors occurring when updating user profile information",
        priority: "URGENT",
        estimatedHours: 3
      },
      {
        title: "Prepare meeting minutes and action items",
        description: "Document key decisions from today's meeting and distribute to stakeholders",
        priority: "LOW",
        estimatedHours: 2
      },
      {
        title: "Optimize frontend bundle size",
        description: "Analyze and reduce JavaScript bundle size through code splitting and lazy loading",
        priority: "MEDIUM",
        estimatedHours: 5
      },
      {
        title: "Set up monitoring and alerts for production",
        description: "Configure application performance monitoring and error tracking systems",
        priority: "HIGH",
        estimatedHours: 4
      },
      {
        title: "Create unit tests for payment processing",
        description: "Write comprehensive test suite for payment gateway integration",
        priority: "MEDIUM",
        estimatedHours: 7
      },
      {
        title: "Review and update API documentation",
        description: "Ensure all endpoints are properly documented with examples and error responses",
        priority: "LOW",
        estimatedHours: 3
      }
    ];

    // Select 2-4 random tasks and assign to participants
    const numTasks = Math.floor(Math.random() * 3) + 2; // 2-4 tasks
    const selectedTasks = [];

    for (let i = 0; i < numTasks; i++) {
      const templateIndex = Math.floor(Math.random() * taskTemplates.length);
      const task = { ...taskTemplates[templateIndex] };

      // Assign to a random participant
      if (participants && participants.length > 0) {
        const assigneeIndex = Math.floor(Math.random() * participants.length);
        task.assignee = participants[assigneeIndex];
      } else {
        task.assignee = "Unassigned";
      }

      // Generate a realistic deadline (within 1-2 weeks)
      const daysUntilDeadline = Math.floor(Math.random() * 14) + 1;
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + daysUntilDeadline);
      task.deadline = deadline.toISOString().split('T')[0]; // YYYY-MM-DD format

      selectedTasks.push(task);
    }

    return selectedTasks;
  },

  /**
   * Simulates AI task assignment based on employee skills and workload
   * @param {Array} tasks - List of tasks to assign
   * @param {Array} employees - List of available employees
   * @returns {Promise<Array>} - Tasks with assignees
   */
  assignTasks: async (tasks, employees) => {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Assign tasks to employees based on simple round-robin for demo
    return tasks.map((task, index) => {
      if (!task.assignee || task.assignee === "Unassigned") {
        if (employees && employees.length > 0) {
          const assigneeIndex = index % employees.length;
          return {
            ...task,
            assignee: employees[assigneeIndex].name,
            assigneeId: employees[assigneeIndex].id
          };
        }
      }
      return task;
    });
  },

  /**
   * Calculates priority for a task based on description and context
   * @param {Object} task - Task object
   * @returns {string} - Priority level
   */
  calculatePriority: (task) => {
    // Simple keyword-based priority calculation for demo
    const description = (task.description || "").toLowerCase();
    const title = (task.title || "").toLowerCase();
    const text = description + " " + title;

    if (text.includes("bug") || text.includes("fix") || text.includes("error") || text.includes("urgent")) {
      return "URGENT";
    }
    if (text.includes("optimize") || text.includes("performance") || text.includes("security")) {
      return "HIGH";
    }
    if (text.includes("document") || text.includes("review") || text.includes("prepare")) {
      return "LOW";
    }
    return "MEDIUM"; // Default
  },

  /**
   * Main function to process a meeting: summarize, extract tasks, and assign
   * @param {Object} meetingData - Meeting data including transcript and participants
   * @returns {Promise<Object>} - Processed meeting results
   */
  processMeeting: async (meetingData) => {
    try {
      // Step 1: Summarize the meeting
      const summary = await mockAI.summarizeMeeting(meetingData.transcript || "");

      // Step 2: Extract tasks from transcript
      const extractedTasks = await mockAI.extractTasks(
        meetingData.transcript || "",
        meetingData.participants || []
      );

      // Step 3: Assign priorities to tasks
      const tasksWithPriority = extractedTasks.map(task => ({
        ...task,
        priority: task.priority || mockAI.calculatePriority(task)
      }));

      // Step 4: Return processed results
      return {
        summary: summary.summary,
        keyDiscussionPoints: summary.keyDiscussionPoints,
        actionItems: summary.actionItems,
        tasks: tasksWithPriority,
        processingTime: Date.now()
      };
    } catch (error) {
      console.error("Error in AI processing:", error);
      throw new Error("AI processing failed");
    }
  }
};

export default mockAI;