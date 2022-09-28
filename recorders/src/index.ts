import PoolsProcessor from "./processors/PoolsProcessor";
import { BlockData } from "types";
import { config } from "./config";
import { buildDependencies } from "./dependencies";
import BlockListener from "./infrastructure/Blocklistener";
import HeartBeat from "./infrastructure/Heartbeat";
import LocksProcessor from "./processors/LocksProcessor";
import BribesProcessor from "./processors/BribesProcessor";
import PositionsProcessor from "./processors/PositionsProcessor";
import VotesProcessor from "./processors/VotesProcessor";
import FeesProcessor from "./processors/FeesProcessor";
import EpochsProcessor from "./processors/EpochsProcessor";
import SlopesProcessor from "./processors/SlopeProcessor";
const dependencies = buildDependencies(config);

const heartbeat = new HeartBeat(config);
const locksProcesser = new LocksProcessor(dependencies);
const bribesProcessor = new BribesProcessor(dependencies);
const positionProcessor = new PositionsProcessor(dependencies);
const poolsProcessor = new PoolsProcessor(dependencies, bribesProcessor, positionProcessor);
const votesProcessor = new VotesProcessor(dependencies);
const feesProcessor = new FeesProcessor(dependencies);
const blockListener = new BlockListener(config);
const epochsProcessor = new EpochsProcessor(dependencies);
const slopesProcessor = new SlopesProcessor(dependencies);
(async () => {
  try {
    heartbeat.start();
    await dependencies.dbClient.init();
    locksProcesser.process();
    await poolsProcessor.process();
    await votesProcessor.process();
    await feesProcessor.process();
    //await slopesProcessor.process();
    await epochsProcessor.process();
    blockListener.listen();
    blockListener.blockEmitter.on("newBlock", (b: BlockData) => {
      console.log("block listener got a new block", b.level, b.hash);
      setTimeout(async function () {
        await locksProcesser.updateLocks(b.level);
        await poolsProcessor.updatePools(b.level);
        await bribesProcessor.updateBribes(b.level);
        await positionProcessor.updatePositions(b.level);
        await votesProcessor.epochUpdates(b.level);
        //await slopesProcessor.updateSlopes(b.level);
        await votesProcessor.votesUpdates(b.level);
        await feesProcessor.updateFees(b.level);
      }, 5000);
    });
  } catch (err) {
    console.error(err.message);
  }
})();
