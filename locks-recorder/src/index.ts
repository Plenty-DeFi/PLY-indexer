import { BlockData } from "types";
import { config } from "./config";
import { buildDependencies } from "./dependencies";
import BlockListener from "./infrastructure/Blocklistener";
import HeartBeat from "./infrastructure/Heartbeat";
import LocksProcessor from "./processors/LocksProcessor";

const dependencies = buildDependencies(config);

const heartbeat = new HeartBeat(config);
const locksProcesser = new LocksProcessor(dependencies);
const blockListener = new BlockListener(config);
(async () => {
  try {
    heartbeat.start();
    await dependencies.dbClient.init();
    locksProcesser.process();
    blockListener.listen();
    blockListener.blockEmitter.on("newBlock", (b: BlockData) => {
      console.log("YAY block listener got a new block", b.level, b.hash);
      locksProcesser.updateLocks(b.level);
    });
  } catch (err) {
    console.error(err.message);
  }
})();
