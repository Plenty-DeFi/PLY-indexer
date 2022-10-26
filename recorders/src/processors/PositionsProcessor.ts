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
  async process(amm: string, gaugeBigMap: string, derivedBigMap: string, attachBigMap: string, lqtBigMap: string) {
    try {
      console.log("Positions processing started for", amm, gaugeBigMap, lqtBigMap);
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
            await this._processPosition(
              balance.key,
              balance.value.balance,
              amm,
              gaugeBigMap,
              derivedBigMap,
              attachBigMap
            );
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error from positions a-", e);
    }
  }

  private async _processPosition(
    userAddress: string,
    balance: string,
    amm: string,
    gaugeBigMap: string,
    derivedBigMap: string,
    attachBigMap: string
  ) {
    try {
      const stakedBalance = await this._tkztProvider.getStakeBalance({
        bigMap: gaugeBigMap,
        address: userAddress,
      });
      const derivedBalance = await this._tkztProvider.getStakeBalance({
        bigMap: derivedBigMap,
        address: userAddress,
      });

      const existingPos = await this._dbClient.get({
        select: "*",
        table: "positions",
        where: `amm = '${amm}' AND user_address = '${userAddress}'`,
      });
      if (existingPos.rowCount === 0) {
        if (stakedBalance === "0" && balance === "0") {
          console.log("Skipping Position", amm, userAddress, balance, stakedBalance, derivedBalance);
        } else {
          console.log("Inserting Position", amm, userAddress, balance, stakedBalance, derivedBalance);
          this._dbClient.insert({
            table: "positions",
            columns: "(amm, user_address, balance, staked_balance, derived_balance, attach_BigMap)",
            values: `('${amm}', '${userAddress}', '${balance}', '${stakedBalance}', '${derivedBalance}', '${attachBigMap}')`,
          });
        }
      } else {
        if (stakedBalance === "0" && balance === "0") {
          console.log("Deleting Positions", amm, userAddress);
          this._dbClient.delete({
            table: "positions",
            where: `amm = '${amm}' AND user_address = '${userAddress}'`,
          });
        } else {
          console.log("Updating Positions", amm, userAddress, balance, stakedBalance, derivedBalance);
          this._dbClient.update({
            table: "positions",
            set: `balance='${balance}', staked_balance='${stakedBalance}', derived_balance='${derivedBalance}'`,
            where: `amm = '${amm}' AND user_address = '${userAddress}'`,
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
            for (const update of updates) {
              await this._processPosition(
                update.content.key,
                update.content.value.balance,
                pool.amm,
                pool.gauge_bigmap,
                pool.derived_bigmap,
                pool.attach_bigmap
              );
            }
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
