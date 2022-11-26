import axios from "axios";
import { getTokenSymbol } from "../infrastructure/utils";
import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import { Config, Dependecies, Contracts, Checkpoints } from "../types";
import { totalVotingPower } from "../infrastructure/utils";

export default class EpochsProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  private _contracts: Contracts;
  constructor({ config, dbClient, tzktProvider, contracts }: Dependecies) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
    this._contracts = contracts;
  }
  async process() {
    try {
      console.log("Epochs processing started");
      //const globalCheckpoints = await this.getGlobalCheckpoint();
      let offset = 0;
      while (true) {
        const epochEnds: any[] = await this._tkztProvider.getBigMap({
          bigMap: this._contracts.bigMaps.epoch_end.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (epochEnds.length === 0) {
          break;
        } else {
          for (var epoch of epochEnds) {
            const epochEndTs = (Date.parse(epoch.value) / 1000).toFixed(0);
            const epochNumber = epoch.key;
            await this._processEpoch(epochNumber, epochEndTs);
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error from Epoch Processing", e);
    }
  }

  async getGlobalCheckpoint() {
    let offset = 0;
    let globalCheckpoints: Checkpoints[] = [];
    const map1 = new Map();
    while (true) {
      const checkpoints = await this._tkztProvider.getBigMap({
        bigMap: this._contracts.bigMaps.global_checkpoints.toString(),
        limit: this._config.tzktLimit,
        offset,
      });
      if (checkpoints.length === 0) {
        for (var x in globalCheckpoints) {
          map1.set(globalCheckpoints[x].key, globalCheckpoints[x].value);
        }
        break;
      } else {
        globalCheckpoints = globalCheckpoints.concat(checkpoints);
        offset += this._config.tzktOffset;
      }
    }
    return map1;
  }

  async _processEpoch(epoch: string, epochEndTs: string, globalCheckpoints?: Map<string, any>) {
    try {
      /*       if (!globalCheckpoints) {
        globalCheckpoints = await this.getGlobalCheckpoint();
      } */
      const existingEpoch = await this._dbClient.get({
        select: "*",
        table: "epochs",
        where: `epoch = '${epoch}'`,
      });
      if (existingEpoch.rowCount === 0) {
        const ts = parseInt(epochEndTs) - 7 * 86400;
        const totalVp = await totalVotingPower({
          rpc: this._config.rpc,
          ts: ts.toString(),
          voteEscrow: this._contracts.voteEscrow.address,
        });
        const epochInflation = await this._tkztProvider.getEpochInflation(
          this._contracts.bigMaps.epoch_inflation.toString(),
          epoch
        );
        console.log("Inserting Epoch", epoch, totalVp);
        await this._dbClient.insert({
          table: "epochs",
          columns: "(epoch, epoch_end_ts, epoch_total_vp, epoch_inflation)",
          values: `('${epoch}', '${epochEndTs}', '${totalVp}', '${epochInflation}')`,
        });
      } else {
        console.log("Epoch already exists", epoch);
      }
    } catch (e) {
      console.log("Error from Epoch", e);
      throw e;
    }
  }
}
