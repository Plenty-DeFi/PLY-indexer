import { config } from "./config";
import { buildDependencies } from "./dependencies";

import HeartBeat from "./infrastructure/Heartbeat";
import LocksProcessor from "./processors/LocksProcessor";

const dependencies = buildDependencies(config);

const heartbeat = new HeartBeat(config);
const locksProcesser = new LocksProcessor(dependencies);

(async () => {
  try {
    heartbeat.start();
    await dependencies.dbClient.init();
    locksProcesser.process();
  } catch (err) {
    console.error(err.message);
  }
})();
