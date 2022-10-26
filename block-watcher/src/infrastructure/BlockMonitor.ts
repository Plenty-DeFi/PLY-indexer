import { RpcClient } from "@taquito/rpc";
import axios from "axios";
import Messenger from "./Messenger";
import { Config } from "../types";

export default class BlockMonitor {
  private _tzkt: string;
  private _lastBlockHash: string;

  constructor({ tzkt }: Config) {
    this._lastBlockHash = "";
    this._tzkt = tzkt;
  }

  monitor(messenger: Messenger): void {
    setInterval(() => this.getBlock(messenger), 1000);
  }

  private async getBlock(messenger: Messenger): Promise<void> {
    try {
      const block = (await axios.get(`${this._tzkt}/head`)).data;
      if (block.hash === this._lastBlockHash) {
        return;
      } else {
        this._lastBlockHash = block.hash;
        console.log(
          `Found Block ${block.level.toString()} ${
            block.hash
          } at ${block.timestamp.toLocaleString()}`
        );
        messenger.broadcast({
          hash: block.hash,
          level: block.level.toString(),
          timestamp: block.timestamp.toString(),
        });
      }
    } catch (err) {
      console.error(err);
    }
  }
}
