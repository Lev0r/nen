const STORE_MIN_GAP_MS = 400;
const STEAM_WEB_API_MIN_GAP_MS = 300;
const STEAM_WEB_API_MAX_CONCURRENT = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createSerialQueue(minGapMs) {
  let chain = Promise.resolve();
  let lastStartedAt = 0;

  return function schedule(fn) {
    const run = async () => {
      const now = Date.now();
      const waitMs = Math.max(0, minGapMs - (now - lastStartedAt));
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      lastStartedAt = Date.now();
      return fn();
    };

    const result = chain.then(run, run);
    chain = result.then(
      () => {},
      () => {}
    );
    return result;
  };
}

function createConcurrentPool(maxConcurrent, minGapMs) {
  let activeCount = 0;
  const waitQueue = [];
  let lastStartedAt = 0;

  function tryStartNext() {
    while (activeCount < maxConcurrent && waitQueue.length > 0) {
      const { fn, resolve, reject } = waitQueue.shift();
      activeCount += 1;

      (async () => {
        try {
          const now = Date.now();
          const waitMs = Math.max(0, minGapMs - (now - lastStartedAt));
          if (waitMs > 0) {
            await sleep(waitMs);
          }
          lastStartedAt = Date.now();
          resolve(await fn());
        } catch (err) {
          reject(err);
        } finally {
          activeCount -= 1;
          tryStartNext();
        }
      })();
    }
  }

  return function schedule(fn) {
    return new Promise((resolve, reject) => {
      waitQueue.push({ fn, resolve, reject });
      tryStartNext();
    });
  };
}

const scheduleStoreRequest = createSerialQueue(STORE_MIN_GAP_MS);
const scheduleSteamWebApiRequest = createConcurrentPool(
  STEAM_WEB_API_MAX_CONCURRENT,
  STEAM_WEB_API_MIN_GAP_MS
);

function scheduleThirdPartyRequest(fn) {
  return fn();
}

module.exports = {
  scheduleStoreRequest,
  scheduleSteamWebApiRequest,
  scheduleThirdPartyRequest,
};
