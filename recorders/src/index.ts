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
import { addRetryToAxios } from "./utils";
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
    addRetryToAxios();
    await dependencies.dbClient.init();
    //await locksProcesser.process();
    await poolsProcessor.process();
    await votesProcessor.process();
    await feesProcessor.process();
    //await slopesProcessor.process();
    await epochsProcessor.process();
    blockListener.listen();
    let processing = false;
    let lastBlockProcessed = dependencies.config.startingBlock;

    blockListener.blockEmitter.on("newBlock", async (b: BlockData) => {
      if (processing || parseInt(b.level) < parseInt(lastBlockProcessed)) {
        console.log("Task already running willl process ", b.level, " later");
        return;
      }
      processing = true;
      //console.log("block listener got a new block", b.level, b.hash);
      try {
        for (let i = parseInt(lastBlockProcessed) + 1; i <= parseInt(b.level); i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          console.log("Processing block", i);
          await locksProcesser.updateLocks(b.level);
          await poolsProcessor.updatePools(b.level);
          await bribesProcessor.updateBribes(b.level);
          await positionProcessor.updatePositions(b.level);
          await votesProcessor.epochUpdates(b.level);
          await votesProcessor.votesUpdates(b.level);
          await feesProcessor.updateFees(b.level);
          lastBlockProcessed = i.toString();
        }
        processing = false;
      } catch (e) {
        console.log("Error processing block", e);
        processing = false;
      }
    });
  } catch (err) {
    console.error(err.message);
  }
})();
