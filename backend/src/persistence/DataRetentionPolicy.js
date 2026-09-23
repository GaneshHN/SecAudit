const { JOB_STATES } = require('../jobs/ScanJobStateMachine');

class DataRetentionPolicy {
  constructor(unitOfWork, config = {}) {
    this.unitOfWork = unitOfWork;
    this.retentionDays = config.retentionDays || 30; // Default 30 days
  }

  /**
   * Cleans up expired jobs, results, and events based on retention policy.
   * This would typically be scheduled via a cron job.
   */
  async cleanupExpiredData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    const cutoffTime = cutoffDate.getTime();

    console.log(`[DataRetentionPolicy] Starting cleanup for data older than ${this.retentionDays} days (${cutoffDate.toISOString()})`);

    let jobsDeleted = 0;
    
    // Using includeDeleted = false by default to just check active
    // We fetch all jobs and then check completedTime
    const allJobs = await this.unitOfWork.scanJobs.query();
    
    for (const job of allJobs) {
      const isCompletedOrFailed = [JOB_STATES.COMPLETED, JOB_STATES.FAILED, JOB_STATES.CANCELLED].includes(job.status);
      
      if (isCompletedOrFailed && job.completedTime) {
        const completedTimeMs = new Date(job.completedTime).getTime();
        
        if (completedTimeMs < cutoffTime) {
          try {
            await this.unitOfWork.scanJobs.delete(job.id);
            await this.unitOfWork.scanResults.delete(job.id);
            await this.unitOfWork.events.deleteEventsForJob(job.id);
            jobsDeleted++;
          } catch (err) {
            console.error(`[DataRetentionPolicy] Failed to soft delete job ${job.id}:`, err.message);
          }
        }
      }
    }

    if (jobsDeleted > 0) {
      await this.unitOfWork.commit();
      console.log(`[DataRetentionPolicy] Cleanup complete. Soft deleted ${jobsDeleted} expired jobs.`);
    } else {
      console.log(`[DataRetentionPolicy] Cleanup complete. No expired jobs found.`);
    }

    return jobsDeleted;
  }
}

module.exports = DataRetentionPolicy;
