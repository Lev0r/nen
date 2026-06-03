const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { DEFAULT_APP_ID, schedulerStateDocPath } = require('./lib/firestorePaths');
const { TASK_REGISTRY, isTaskDue, runTask } = require('./scheduler/tasks');

function emptySchedulerState() {
  return { tasks: {} };
}

async function runScheduledTick(appId = DEFAULT_APP_ID) {
  const db = getFirestore();
  const stateRef = db.doc(schedulerStateDocPath(appId));
  const snap = await stateRef.get();
  const state = snap.exists ? snap.data() : emptySchedulerState();
  const now = Date.now();

  const dueTasks = TASK_REGISTRY.filter((task) => isTaskDue(task.id, state, now));
  if (dueTasks.length === 0) {
    console.log(`runScheduledTick(${appId}): no tasks due`);
    return { appId, dueTasks: [], results: [] };
  }

  const tasksState = { ...(state.tasks || {}) };
  for (const task of dueTasks) {
    tasksState[task.id] = {
      ...(tasksState[task.id] || {}),
      lastRunAt: now,
    };
  }

  await stateRef.set(
    {
      tasks: tasksState,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const context = { db, now };
  const settled = await Promise.allSettled(
    dueTasks.map(async (task) => {
      const result = await runTask(task.id, appId, { ...state, tasks: tasksState }, context);
      return { taskId: task.id, result };
    })
  );

  const completedAt = Date.now();
  const updatedTasks = { ...tasksState };

  settled.forEach((outcome, index) => {
    const taskId = dueTasks[index].id;
    if (outcome.status === 'fulfilled') {
      updatedTasks[taskId] = {
        ...(updatedTasks[taskId] || {}),
        lastCompleteAt: completedAt,
      };
    } else {
      console.error(`runScheduledTick(${appId}): task ${taskId} failed`, outcome.reason);
    }
  });

  await stateRef.set(
    {
      tasks: updatedTasks,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  const results = settled.map((outcome, index) => ({
    taskId: dueTasks[index].id,
    status: outcome.status,
    value: outcome.status === 'fulfilled' ? outcome.value : undefined,
    reason: outcome.status === 'rejected' ? String(outcome.reason) : undefined,
  }));

  console.log(
    `runScheduledTick(${appId}): ran ${dueTasks.length} task(s): ${dueTasks.map((t) => t.id).join(', ')}`
  );

  return {
    appId,
    dueTasks: dueTasks.map((task) => task.id),
    results,
  };
}

const scheduledSyncOrchestrator = onSchedule(
  {
    schedule: 'every 6 hours',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    try {
      await runScheduledTick(DEFAULT_APP_ID);
    } catch (err) {
      console.error('scheduledSyncOrchestrator failed:', err);
      throw err;
    }
  }
);

module.exports = {
  runScheduledTick,
  scheduledSyncOrchestrator,
};
