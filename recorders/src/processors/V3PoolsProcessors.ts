import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import { Config, Dependecies, PoolV3, V3Pool } from "../types";

import V3PositionsProcessor from "./V3PositionsProcessor";
import { getV3Pools } from "../infrastructure/utils";

export default class V3PoolsProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  private _positionProcessor: V3PositionsProcessor;
  constructor(
    { config, dbClient, tzktProvider }: Dependecies,

    v3positionProcessor: V3PositionsProcessor
  ) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
    this._positionProcessor = v3positionProcessor;
  }

  async process(): Promise<void> {
    try {
      const pools = await getV3Pools(this._dbClient);
      for (const key in pools) {
        if (Object.prototype.hasOwnProperty.call(pools, key)) {
          const pool = pools[key];
          const existingEntry = await this._dbClient.get({
            select: "*",
            table: "v3_pools",
            where: `amm='${pool.address}'`,
          });
          if (existingEntry.rowCount === 0) {
            await this._processPool(pool);
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  private async _processPool(pool: PoolV3): Promise<void> {
    try {
      //get Positions BigMap
      const positions_BigMap = await this._tkztProvider.getPositionsBigMap(pool.address);
      //process all position
      await this._positionProcessor.process(pool.address, positions_BigMap);

      //save in db
      console.log(`Inserting V3Pool ${pool.address}`);
      this._dbClient.insert({
        table: "v3_pools",
        columns:
          "(amm, fee_bps, token1, token2, token1_variant, token2_variant, token1_decimals, token2_decimals, token1_symbol, token2_symbol, token1_Id, token2_Id, positions_BigMap)",
        values: `('${pool.address}', '${pool.feeBps}', '${pool.tokenX.address}', '${pool.tokenY.address}', '${
          pool.tokenX.standard
        }', '${pool.tokenY.standard}', '${pool.tokenX.decimals}', '${pool.tokenY.decimals}', '${
          pool.tokenX.symbol
        }', '${pool.tokenY.symbol}', ${pool.tokenX.tokenId || null}, ${
          pool.tokenY.tokenId || null
        }, '${positions_BigMap}')`,
      });
    } catch (e) {
      console.log(e);
    }
  }

  /*   async updatePools(level: string): Promise<void> {
    try {
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.amm_to_gauge_bribe.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          updates.forEach(async (update) => {
            if (update.action === "add_key") {
              await this._processPool({
                key: update.content.key,
                value: update.content.value,
              });
            } else {
              console.log("Removing poool", update.content.key);
              await this._dbClient.delete({
                table: "pools",
                where: `amm='${update.content.key}'`,
              });
            }
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  } */
}
