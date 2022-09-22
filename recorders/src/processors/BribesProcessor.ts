import axios from "axios";
import { getTokens, getTokenSymbol } from "../infrastructure/utils";
import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import {
  Config,
  Dependecies,
  Contracts,
  PoolsApiResponse,
  BigMapUpdateResponseType,
  AmmData,
  BribeApiResponse,
  Token,
  Pool,
} from "../types";

export default class BribesProcessor {
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
  async process(bribeBigMap: string, amm: string, tokens: Token[]) {
    try {
      console.log("Bribes processing started for", amm);
      let offset = 0;
      while (true) {
        const bribes = await this._tkztProvider.getBribes({
          bigMap: bribeBigMap,
          limit: this._config.tzktLimit,
          offset,
        });
        if (bribes.length === 0) {
          break;
        } else {
          bribes.forEach(async (bribe) => {
            await this._processBribe(bribe, amm, tokens);
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error from bribes", e);
    }
  }

  private async _processBribe(bribe: BribeApiResponse, amm: string, tokens: Token[]) {
    try {
      const tokenSymbol = getTokenSymbol(bribe.value.bribe.type, tokens);
      /*       const price = (await axios.get(this._config.networkIndexer + "/analytics/tokens/" + tokenSymbol)).data[0].price
        .value; */
      const price = "1"; //todo change later
      console.log("Inserting Bribe", amm, tokenSymbol, bribe.value.bribe.value, price);
      await this._dbClient.insert({
        table: "bribes",
        columns: "(amm, epoch, bribe_id, provider, value, price, name)",
        values: `('${amm}', '${bribe.key.epoch}', '${bribe.key.bribe_id}', '${bribe.value.provider}', '${bribe.value.bribe.value}', '${price}', '${tokenSymbol}')`,
      });
    } catch (e) {
      console.log("Error from bribes", e);
      throw e;
    }
  }

  async updateBribes(level: string): Promise<void> {
    try {
      const pools: Pool[] = (
        await this._dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        })
      ).rows;
      const tokens = await getTokens(this._config);
      pools.forEach(async (pool) => {
        let offset = 0;
        while (true) {
          const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
            level,
            bigmapId: pool.bribe_bigmap.toString(),
            limit: this._config.tzktLimit,
            offset,
          });
          if (updates.length === 0) {
            break;
          } else {
            updates.forEach(async (update) => {
              if (update.action === "add_key") {
                await this._processBribe(update.content, pool.amm, tokens);
              }
            });
            offset += this._config.tzktOffset;
          }
        }
      });
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  }
}
