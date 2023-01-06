import axios from "axios";
import { getTokenSymbol } from "../infrastructure/utils";
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
import { getTokens } from "dependencies";

export default class BribesProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  private _contracts: Contracts;
  private _getTokenPrice: () => Promise<any>;
  private _getTokens: () => Promise<Token[]>;
  constructor({ config, dbClient, tzktProvider, contracts, getTokenPrice, getTokens }: Dependecies) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
    this._contracts = contracts;
    this._getTokenPrice = getTokenPrice;
    this._getTokens = getTokens;
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
      const token = (await this._getTokenPrice()).find((token1: any) => token1.token === tokenSymbol);
      const price = token ? token.price.value : "0";

      if (!token) {
        console.log("Not find in analytics ", tokenSymbol);
      }

      console.log("Inserting Bribe", amm, tokenSymbol, bribe.value.bribe.value, price);
      const bribes = await this._dbClient.get({
        select: "*",
        table: "bribes",
        where: `amm='${amm}' AND epoch='${bribe.key.epoch}' AND bribe_id='${bribe.key.bribe_id}'`,
      });
      if (bribes.rowCount === 0) {
        await this._dbClient.insert({
          table: "bribes",
          columns: "(amm, epoch, bribe_id, provider, value, price, name)",
          values: `('${amm}', '${bribe.key.epoch}', '${bribe.key.bribe_id}', '${bribe.value.provider}', '${bribe.value.bribe.value}', '${price}', '${tokenSymbol}')`,
        });
      } else {
        console.log("Bribe already exists", amm, tokenSymbol, bribe.value.bribe.value, price);
      }
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
      const tokens = await this._getTokens();
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
