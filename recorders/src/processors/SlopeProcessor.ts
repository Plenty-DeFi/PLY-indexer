import axios from "axios";
import { getTokens, getTokenSymbol } from "../infrastructure/utils";
import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import { Config, Dependecies, Contracts, BigMapUpdateResponseType } from "../types";

export default class SlopesProcessor {
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
      console.log("Slope processing started");
      let offset = 0;
      while (true) {
        const slopes = await this._tkztProvider.getBigMap({
          bigMap: this._contracts.bigMaps.slope_changes.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (slopes.length === 0) {
          break;
        } else {
          slopes.forEach(async (slope: any) => {
            await this._dbClient.insert({
              table: "slopes",
              columns: "(ts, slope)",
              values: `('${slope.key}', '${slope.value}')`,
            });
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error from slopes", e);
    }
  }

  async updateSlopes(level: string): Promise<void> {
    try {
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.slope_changes.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          updates.forEach(async (update) => {
            await this._dbClient.insert({
              table: "slopes",
              columns: "(ts, slope)",
              values: `('${update.content.key}', '${update.content.value}')`,
            });
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error slopes:", err);
      throw err;
    }
  }
}
