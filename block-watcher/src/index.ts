import Messenger from "./infrastructure/Messenger";
import Heartbeat from "./infrastructure/Heartbeat";
import BlockMonitor from "./infrastructure/BlockMonitor";
import { addRetryToAxios } from "./utils";
import { config } from "./config";

addRetryToAxios();
const messenger = new Messenger(config);
const heartBeat = new Heartbeat(config);
const blockMonitor = new BlockMonitor(config);

messenger.bind();
heartBeat.start();
blockMonitor.monitor(messenger);
