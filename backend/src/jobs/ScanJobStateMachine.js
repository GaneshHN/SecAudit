/**
 * Formal State Machine for ScanJob Lifecycle.
 */

const JOB_STATES = {
  QUEUED: 'QUEUED',
  WAITING: 'WAITING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  RETRYING: 'RETRYING',
  TIMEOUT: 'TIMEOUT',
};

// Formal State Transition Matrix (Allowed transitions for each state)
const VALID_TRANSITIONS = {
  [JOB_STATES.QUEUED]: [JOB_STATES.WAITING, JOB_STATES.RUNNING, JOB_STATES.CANCELLED],
  [JOB_STATES.WAITING]: [JOB_STATES.RUNNING, JOB_STATES.CANCELLED],
  [JOB_STATES.RUNNING]: [JOB_STATES.COMPLETED, JOB_STATES.FAILED, JOB_STATES.RETRYING, JOB_STATES.TIMEOUT, JOB_STATES.CANCELLED],
  [JOB_STATES.RETRYING]: [JOB_STATES.QUEUED, JOB_STATES.RUNNING, JOB_STATES.FAILED, JOB_STATES.CANCELLED],
  [JOB_STATES.TIMEOUT]: [JOB_STATES.RETRYING, JOB_STATES.FAILED, JOB_STATES.CANCELLED],
  [JOB_STATES.COMPLETED]: [], // Terminal state
  [JOB_STATES.FAILED]: [JOB_STATES.QUEUED], // Allow explicit user re-queuing
  [JOB_STATES.CANCELLED]: [], // Terminal state
};

class InvalidStateTransitionError extends Error {
  constructor(fromState, toState) {
    super(`Invalid state transition: Cannot transition job from '${fromState}' to '${toState}'.`);
    this.name = 'InvalidStateTransitionError';
    this.fromState = fromState;
    this.toState = toState;
  }
}

class ScanJobStateMachine {
  /**
   * Check if a state transition is valid.
   * @param {string} fromState 
   * @param {string} toState 
   * @returns {boolean}
   */
  static canTransition(fromState, toState) {
    const allowed = VALID_TRANSITIONS[fromState];
    return allowed ? allowed.includes(toState) : false;
  }

  /**
   * Validate state transition or throw error.
   * @param {string} currentState 
   * @param {string} nextState 
   * @returns {string} The validated new state
   */
  static transition(currentState, nextState) {
    if (currentState === nextState) return currentState;
    if (!ScanJobStateMachine.canTransition(currentState, nextState)) {
      throw new InvalidStateTransitionError(currentState, nextState);
    }
    return nextState;
  }
}

module.exports = { JOB_STATES, VALID_TRANSITIONS, InvalidStateTransitionError, ScanJobStateMachine };
