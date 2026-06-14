export function normalizeSuggestion(task) {
  const missingFields = [
    !task.assigneeId ? 'assigneeId' : null,
    !task.deadline ? 'deadline' : null,
  ].filter(Boolean);

  return {
    ...task,
    missingFields,
    needsConfirmation: missingFields.length > 0,
  };
}
