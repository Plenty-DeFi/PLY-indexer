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
import V3PoolsProcessor from "./processors/V3PoolsProcessors";
import V3PositionsProcessor from "./processors/V3PositionsProcessor";
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
const v3PositionsProcessor = new V3PositionsProcessor(dependencies);
const v3PoolsProcessor = new V3PoolsProcessor(dependencies, v3PositionsProcessor);
const epochsProcessor = new EpochsProcessor(dependencies);
const slopesProcessor = new SlopesProcessor(dependencies);
(async () => {
  try {
    heartbeat.start();
    addRetryToAxios();
    await dependencies.dbClient.init();
    if (config.initialIndexing == "true") {
      await poolsProcessor.process();
      await locksProcesser.process();
      // await votesProcessor.process();
      // await feesProcessor.process();
      // //await slopesProcessor.process();
      // await epochsProcessor.process();

      //await v3PoolsProcessor.process();
    }

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
          await new Promise((resolve) => setTimeout(resolve, 300));
          console.log("--------------- Processing block", i, "----------------");
          await locksProcesser.updateLocks(i.toString());
          await poolsProcessor.updatePools(i.toString());
          await bribesProcessor.updateBribes(i.toString());
          await positionProcessor.updatePositions(i.toString());
          await votesProcessor.epochUpdates(i.toString());
          await votesProcessor.votesUpdates(i.toString());
          await feesProcessor.updateFees(i.toString());
          await v3PoolsProcessor.process();
          await v3PositionsProcessor.updatePositions(i.toString());
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
