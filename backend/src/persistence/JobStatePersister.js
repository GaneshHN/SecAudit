const { defaultEventBus } = require('../events/LocalEventBus');
const { JOB_EVENTS } = require('../events/JobEvents');

class JobStatePersister {
  /**
   * @param {import('./interfaces/IUnitOfWork')} unitOfWork 
   */
  constructor(unitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  start() {
    const jobEventsToPersist = [
      JOB_EVENTS.JOB_CREATED,
      JOB_EVENTS.JOB_STARTED,
      JOB_EVENTS.JOB_COMPLETED,
      JOB_EVENTS.JOB_FAILED,
      JOB_EVENTS.JOB_CANCELLED,
      JOB_EVENTS.STAGE_CHANGED,
      JOB_EVENTS.PROGRESS_UPDATED,
      JOB_EVENTS.RETRY_SCHEDULED,
      JOB_EVENTS.RETRY_STARTED,
      JOB_EVENTS.RETRY_SUCCEEDED,
      JOB_EVENTS.RETRY_FAILED,
      JOB_EVENTS.RETRIES_EXHAUSTED
    ];

    this._handler = async (event) => {
      try {
        const payload = event.payload;
        const job = payload.job || payload; // some events pass job directly, some wrap it

        if (job && job.id && typeof job.toJSON === 'function') {
          await this.unitOfWork.scanJobs.save(job);
          
          // Also save result if completed
          if (event.eventType === JOB_EVENTS.JOB_COMPLETED && payload.result) {
            await this.unitOfWork.scanResults.save(job.id, payload.result);
          }
          
          await this.unitOfWork.commit();
        }
      } catch (err) {
        if (err.name !== 'OptimisticLockingError') {
           console.error(`[JobStatePersister] Failed to persist job state on event ${event.eventType}:`, err.message);
        }
      }
    };

    jobEventsToPersist.forEach(eventType => {
      defaultEventBus.subscribe(eventType, this._handler);
    });

    console.log('[JobStatePersister] Started listening to event bus for job state persistence.');
  }

  stop() {
    const jobEventsToPersist = [
      JOB_EVENTS.JOB_CREATED,
      JOB_EVENTS.JOB_STARTED,
      JOB_EVENTS.JOB_COMPLETED,
      JOB_EVENTS.JOB_FAILED,
      JOB_EVENTS.JOB_CANCELLED,
      JOB_EVENTS.STAGE_CHANGED,
      JOB_EVENTS.PROGRESS_UPDATED,
      JOB_EVENTS.RETRY_SCHEDULED,
      JOB_EVENTS.RETRY_STARTED,
      JOB_EVENTS.RETRY_SUCCEEDED,
      JOB_EVENTS.RETRY_FAILED,
      JOB_EVENTS.RETRIES_EXHAUSTED
    ];

    if (this._handler) {
      jobEventsToPersist.forEach(eventType => {
        defaultEventBus.unsubscribe(eventType, this._handler);
      });
      this._handler = null;
    }
  }
}

module.exports = JobStatePersister;
