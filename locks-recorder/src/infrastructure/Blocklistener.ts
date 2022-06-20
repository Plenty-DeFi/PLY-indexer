import { BlockData } from "types";
import dgram from "dgram";
import EventEmitter from "events";
import { networkInterfaces } from "os";
import { Config } from "types";
const adapter = process.env.ADAPTER;

class BlockEmitter extends EventEmitter {}

export default class BlockListener {
  private address: any;
  blockEmitter: BlockEmitter;
  private port: string;

  constructor(config: Config) {
    this.port = config.port;
    this.blockEmitter = new BlockEmitter();
  }

  listen() {
    const server = dgram.createSocket("udp4");
    console.log("Listening on port", this.port);

    server.on("error", (err: any) => {
      console.log(`server error:\n${err.stack}`);
      server.close();
    });

    server.on("message", (msg: any, rinfo: any) => {
      var decoded = msg;
      var message = JSON.parse(decoded);
      //console.log("Received message from", rinfo.address, message);
      this.blockEmitter.emit("newBlock", message);
      //logger.log(`server got: ${decoded} from ${rinfo.address}:${rinfo.port} at ${new Date()}`);
    });

    server.on("listening", () => {
      console.log(`block-listen-ply ${this.port}`);
    });

    server.bind(parseInt(this.port));
  }
}
