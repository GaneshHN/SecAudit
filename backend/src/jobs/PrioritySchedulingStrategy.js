const ISchedulingStrategy = require('./ISchedulingStrategy');
const { JOB_STATES } = require('./ScanJobStateMachine');
const { jobEvents } = require('../events/JobEvents');
const { JobPriority } = require('./JobPriority');

/**
 * PrioritySchedulingStrategy
 * Implements priority-based scheduling with starvation prevention (aging).
 */
class PrioritySchedulingStrategy extends ISchedulingStrategy {
  constructor(options = {}) {
    super();
    // Increase priority weight by agingFactor every agingIntervalMs
    this.agingFactor = options.agingFactor || 5; 
    this.agingIntervalMs = options.agingIntervalMs || 60000; // 1 minute default
    this.maxPriorityWeight = options.maxPriorityWeight || JobPriority.CRITICAL.weight;
  }

  sort(waitingQueue, jobs) {
    if (!waitingQueue || waitingQueue.length <= 1) return waitingQueue;

    return waitingQueue.sort((a, b) => {
      const jobA = jobs.get(a);
      const jobB = jobs.get(b);
      
      if (!jobA || !jobB) return 0;
      
      const weightA = jobA.schedulingContext ? jobA.schedulingContext.effectivePriorityWeight : (jobA.priority || 10);
      const weightB = jobB.schedulingContext ? jobB.schedulingContext.effectivePriorityWeight : (jobB.priority || 10);

      // Higher weight executes first
      if (weightA !== weightB) {
        return weightB - weightA;
      }
      
      // FIFO fallback for identical priority
      const timeA = jobA.schedulingContext?.lastEnqueuedTime || new Date(jobA.createdTime).getTime();
      const timeB = jobB.schedulingContext?.lastEnqueuedTime || new Date(jobB.createdTime).getTime();
      
      return timeA - timeB;
    });
  }

  applyAging(jobs) {
    let priorityChanged = false;
    const now = Date.now();

    for (const job of jobs.values()) {
      if (job.status !== JOB_STATES.QUEUED || !job.schedulingContext) continue;
      
      const ctx = job.schedulingContext;
      if (!ctx.lastEnqueuedTime) continue;

      const waitTime = now - ctx.lastEnqueuedTime;
      
      // Calculate how many intervals have passed
      const intervals = Math.floor(waitTime / this.agingIntervalMs);
      
      if (intervals > 0) {
        const potentialWeight = ctx.basePriorityWeight + (intervals * this.agingFactor);
        const newWeight = Math.min(potentialWeight, this.maxPriorityWeight);

        if (newWeight > ctx.effectivePriorityWeight) {
          const oldWeight = ctx.effectivePriorityWeight;
          ctx.effectivePriorityWeight = newWeight;
          ctx.recordSchedulingDecision('StarvationPrevention', oldWeight, newWeight, `Waited ${waitTime}ms in queue`);
          
          jobEvents.emitQueueStarvationDetected(job, waitTime);
          jobEvents.emitPriorityChanged(job, oldWeight, newWeight);
          
          priorityChanged = true;
        }
      }
    }

    return priorityChanged;
  }
}

module.exports = PrioritySchedulingStrategy;
