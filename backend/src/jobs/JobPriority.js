/**
 * Standardized Priority Levels
 */
const JobPriority = {
  CRITICAL: { name: 'Critical', weight: 100 },
  HIGH: { name: 'High', weight: 50 },
  NORMAL: { name: 'Normal', weight: 10 },
  LOW: { name: 'Low', weight: 1 },
};

/**
 * Validates and normalizes priority input.
 * @param {string|number} input 
 * @returns {Object} The matching priority level object
 */
function normalizePriority(input) {
  if (!input) return JobPriority.NORMAL;
  
  if (typeof input === 'string') {
    const key = input.toUpperCase();
    if (JobPriority[key]) {
      return JobPriority[key];
    }
  } else if (typeof input === 'number') {
    // Find closest or exact match by weight
    const levels = Object.values(JobPriority).sort((a, b) => b.weight - a.weight);
    for (const level of levels) {
      if (input >= level.weight) return level;
    }
    return JobPriority.LOW;
  }
  
  return JobPriority.NORMAL; // Default fallback
}

module.exports = { JobPriority, normalizePriority };
