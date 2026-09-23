require('dotenv').config();
const { z } = require('zod');

const os = require('os');

// Define environment variable schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().regex(/^\d+$/).transform(Number).default('5000'),
  WORKER_HEALTH_PORT: z.string().regex(/^\d+$/).transform(Number).default('9090'),
  WORKER_CONCURRENCY: z.string().regex(/^\d+$/).transform(Number).default('2'),
  SHUTDOWN_TIMEOUT_MS: z.string().regex(/^\d+$/).transform(Number).default('30000'),
  READINESS_QUEUE_THRESHOLD: z.string().regex(/^\d+$/).transform(Number).default('0'),
  METRICS_ENABLED: z.enum(['true', 'false']).transform(v => v === 'true').default('true'),
  SANDBOX_WORKSPACE_ROOT: z.string().default(os.tmpdir() + '/secaudit-workspaces'),
  SANDBOX_REAPER_INTERVAL_MS: z.string().regex(/^\d+$/).transform(Number).default('900000')
});

// Validate environment variables
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  _env.error.issues.forEach((issue) => {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

const env = _env.data;

module.exports = {
  env,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
};
