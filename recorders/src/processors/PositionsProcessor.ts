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

export default class PositionsProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  constructor({ config, dbClient, tzktProvider }: Dependecies) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
  }
  async process(amm: string, gaugeBigMap: string, lqtBigMap: string) {
    try {
      console.log("Positions processing started for", amm);
      let offset = 0;
      while (true) {
        const lqtBalances = await this._tkztProvider.getLqtBalances({
          bigMap: lqtBigMap,
          limit: this._config.tzktLimit,
          offset,
        });
        if (lqtBalances.length === 0) {
          break;
        } else {
          lqtBalances.forEach(async (balance) => {
            await this._processPosition(balance.key, balance.value.balance, amm, gaugeBigMap);
            offset += this._config.tzktOffset;
          });
        }
      }
    } catch (e) {
      console.log("Error from positions a-", e);
    }
  }

  private async _processPosition(userAddress: string, balance: string, amm: string, gaugeBigMap: string) {
    try {
      const stakedBalance = await this._tkztProvider.getStakeBalance({
        bigMap: gaugeBigMap,
        address: userAddress,
      });

      const existingPos = await this._dbClient.get({
        select: "*",
        table: "positions",
        where: `amm = '${amm}' AND user = '${userAddress}'`,
      });
      if (existingPos.rowCount === 0) {
        if (stakedBalance !== "0" && balance !== "0") {
          console.log("Inserting Position", amm, userAddress, balance, stakedBalance);
          this._dbClient.insert({
            table: "positions",
            columns: "(amm, user, balance, staked_balance)",
            values: `(${amm}, '${userAddress}', '${balance}', '${stakedBalance}')`,
          });
        }
      } else {
        if (stakedBalance === "0" && balance === "0") {
          console.log("Deleting Positions", amm, userAddress);
          this._dbClient.delete({
            table: "positions",
            where: `amm = '${amm}' AND user = '${userAddress}'`,
          });
        } else {
          console.log("Updating Positions", amm, userAddress, balance, stakedBalance);
          this._dbClient.update({
            table: "positions",
            set: `balance='${balance}', staked_balance='${stakedBalance}'`,
            where: `amm = '${amm}' AND user = '${userAddress}`,
          });
        }
      }
    } catch (e) {
      console.log("Error from positions b-", e);
      throw e;
    }
  }

  async updatePositions(level: string): Promise<void> {
    try {
      const pools: Pool[] = (
        await this._dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        })
      ).rows;
      pools.forEach(async (pool) => {
        let offset = 0;
        while (true) {
          const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
            level,
            bigmapId: pool.lqt_token_bigmap.toString(),
            limit: this._config.tzktLimit,
            offset,
          });
          if (updates.length === 0) {
            break;
          } else {
            updates.forEach(async (update) => {
              await this._processPosition(
                update.content.key,
                update.content.value.balance,
                pool.amm,
                pool.gauge_bigmap
              );
            });
            offset += this._config.tzktOffset;
          }
        }
      });
    } catch (err) {
      console.error("error updating position:", err);
      throw err;
    }
  }
}
