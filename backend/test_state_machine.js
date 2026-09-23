const assert = require('assert');
const { JOB_STATES, ScanJobStateMachine, InvalidStateTransitionError } = require('./src/jobs/ScanJobStateMachine');
const { ScanJob } = require('./src/jobs/ScanJob');
const { JobStage } = require('./src/jobs/JobStage');
const ProgressSnapshot = require('./src/jobs/ProgressSnapshot');

async function runTests() {
  console.log('🧪 Starting Job State Machine Tests...\n');

  const job = new ScanJob({ repository: 'test' });
  
  // 1. Initial State
  assert.strictEqual(job.status, JOB_STATES.QUEUED);
  assert.strictEqual(job.transitionHistory.length, 0);

  // 2. Valid Transition & History Check
  job.transitionTo(JOB_STATES.RUNNING, 'Starting job');
  assert.strictEqual(job.status, JOB_STATES.RUNNING);
  assert.strictEqual(job.transitionHistory.length, 1);
  assert.strictEqual(job.transitionHistory[0].previousState, JOB_STATES.QUEUED);
  assert.strictEqual(job.transitionHistory[0].newState, JOB_STATES.RUNNING);
  assert.strictEqual(job.transitionHistory[0].reason, 'Starting job');

  // 3. Progress Validation (Increasing)
  job.updateProgress(new ProgressSnapshot({ progressPercentage: 10 }), JobStage.DOWNLOADING);
  assert.strictEqual(job.progressPercentage, 10);
  
  job.updateProgress(new ProgressSnapshot({ progressPercentage: 50 }), JobStage.SCANNING);
  assert.strictEqual(job.progressPercentage, 50);

  // 4. Progress Validation (Decreasing throws error)
  assert.throws(() => {
    job.updateProgress(new ProgressSnapshot({ progressPercentage: 40 }), JobStage.WALKING);
  }, /Progress cannot decrease/);

  // 5. Invalid Transition throws error
  assert.throws(() => {
    job.transitionTo(JOB_STATES.QUEUED); // RUNNING -> QUEUED is invalid
  }, InvalidStateTransitionError);

  // 6. Valid Transition to Retrying (this resets progress to 0)
  job.transitionTo(JOB_STATES.RETRYING);
  assert.strictEqual(job.status, JOB_STATES.RETRYING);
  assert.strictEqual(job.progressPercentage, 0); // Assert reset behavior
  assert.strictEqual(job.transitionHistory.length, 2);

  // 7. Retrying -> Queued -> Running -> Completed
  job.transitionTo(JOB_STATES.QUEUED);
  job.transitionTo(JOB_STATES.RUNNING);
  
  // Progress 100 on Complete enforcement
  job.transitionTo(JOB_STATES.COMPLETED);
  assert.strictEqual(job.status, JOB_STATES.COMPLETED);
  assert.strictEqual(job.progressPercentage, 100);
  assert.strictEqual(job.currentStage.id, JobStage.COMPLETE.id);

  // 8. Terminal State blocks further transition
  assert.throws(() => {
    job.transitionTo(JOB_STATES.RUNNING);
  }, InvalidStateTransitionError);

  console.log('🎉 All Job State Machine tests passed successfully!');
}

runTests().catch(err => {
  console.error('❌ Tests failed:', err);
  process.exit(1);
});
