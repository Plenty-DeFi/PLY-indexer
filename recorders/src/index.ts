import PoolsProcessor from "./processors/PoolsProcessor";
import { BlockData } from "types";
import { config } from "./config";
import { buildDependencies } from "./dependencies";
import BlockListener from "./infrastructure/Blocklistener";
import HeartBeat from "./infrastructure/Heartbeat";
import LocksProcessor from "./processors/LocksProcessor";
import BribesProcessor from "./processors/BribesProcessor";
import PositionsProcessor from "./processors/PositionsProcessor";

const dependencies = buildDependencies(config);

const heartbeat = new HeartBeat(config);
const locksProcesser = new LocksProcessor(dependencies);
const bribesProcessor = new BribesProcessor(dependencies);
const positionProcessor = new PositionsProcessor(dependencies);
const poolsProcessor = new PoolsProcessor(dependencies, bribesProcessor, positionProcessor);
const blockListener = new BlockListener(config);
(async () => {
  try {
    heartbeat.start();
    await dependencies.dbClient.init();
    locksProcesser.process();
    poolsProcessor.process();
    blockListener.listen();
    blockListener.blockEmitter.on("newBlock", (b: BlockData) => {
      console.log("YAY block listener got a new block", b.level, b.hash);
      setTimeout(function () {
        locksProcesser.updateLocks(b.level);
        poolsProcessor.updatePools(b.level);
        bribesProcessor.updateBribes(b.level);
        positionProcessor.updatePositions(b.level);
      }, 5000);
    });
  } catch (err) {
    console.error(err.message);
  }
})();
