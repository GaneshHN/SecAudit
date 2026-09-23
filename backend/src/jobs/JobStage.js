const { JOB_STATES } = require('./ScanJobStateMachine');

/**
 * Standardized job progress stages with metadata.
 */
const JobStage = {
  QUEUED: {
    id: 'QUEUED',
    displayName: 'Queued',
    weight: 0,
    terminal: false,
    allowedStates: [JOB_STATES.QUEUED, JOB_STATES.RETRYING]
  },
  DOWNLOADING: {
    id: 'DOWNLOADING',
    displayName: 'Downloading Repository',
    weight: 10,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  EXTRACTING: {
    id: 'EXTRACTING',
    displayName: 'Extracting Archive',
    weight: 20,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  PREPARING: {
    id: 'PREPARING',
    displayName: 'Preparing Workspace',
    weight: 35,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  WALKING: {
    id: 'WALKING',
    displayName: 'Walking Files',
    weight: 45,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  LOADING_RULES: {
    id: 'LOADING_RULES',
    displayName: 'Loading Rules',
    weight: 55,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  SCANNING: {
    id: 'SCANNING',
    displayName: 'Scanning Repository',
    weight: 65,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  REPORTING: {
    id: 'REPORTING',
    displayName: 'Generating Report',
    weight: 85,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  PERSISTING: {
    id: 'PERSISTING',
    displayName: 'Persisting Results',
    weight: 95,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING]
  },
  CLEANUP: {
    id: 'CLEANUP',
    displayName: 'Cleaning Workspace',
    weight: 99,
    terminal: false,
    allowedStates: [JOB_STATES.RUNNING, JOB_STATES.FAILED, JOB_STATES.CANCELLED, JOB_STATES.TIMEOUT]
  },
  COMPLETE: {
    id: 'COMPLETE',
    displayName: 'Complete',
    weight: 100,
    terminal: true,
    allowedStates: [JOB_STATES.COMPLETED]
  },
};

/**
 * Validates whether a stage is compatible with a given job state.
 * @param {Object|string} stage 
 * @param {string} state 
 * @returns {boolean}
 */
function isValidStageForState(stage, state) {
  const stageObj = typeof stage === 'string' ? JobStage[stage] || Object.values(JobStage).find(s => s.id === stage) : stage;
  if (!stageObj) return false;
  return stageObj.allowedStates.includes(state);
}

module.exports = { JobStage, isValidStageForState };
