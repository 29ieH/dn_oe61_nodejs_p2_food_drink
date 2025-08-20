import { Queue, JobOptions } from 'bull';
import { ATTEMPTS_DEFAULT, BACKOFF_TYPE_DEFAULT } from '../constant/queue.constant';
import { DELAY_RETRY_DEFAULT } from '../constant/rpc.constants';

export async function addJobWithRetry<T>(
  queue: Queue,
  event: string,
  data: T,
  options?: Partial<JobOptions>,
): Promise<void> {
  await queue.add(event, data, {
    attempts: ATTEMPTS_DEFAULT,
    backoff: {
      type: BACKOFF_TYPE_DEFAULT,
      delay: DELAY_RETRY_DEFAULT,
    },
    removeOnComplete: true,
    removeOnFail: false,
    ...options,
  });
}
