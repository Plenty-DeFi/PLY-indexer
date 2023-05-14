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
  V3PositionsResponse,
} from "../types";

export default class V3PositionsProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  constructor({ config, dbClient, tzktProvider }: Dependecies) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
  }
  async process(amm: string, positionsBigMap: string) {
    try {
      console.log("V3 Positions processing started for", amm, positionsBigMap);
      let offset = 0;
      while (true) {
        const positions: V3PositionsResponse[] = (await this._tkztProvider.getLqtBalances({
          bigMap: positionsBigMap,
          limit: this._config.tzktLimit,
          offset,
        })) as V3PositionsResponse[];
        if (positions.length === 0) {
          break;
        } else {
          positions.forEach(async (position) => {
            await this._processPosition(
              position.key,
              position.value.owner,
              amm,
              position.value.upper_tick_index,
              position.value.lower_tick_index,
              position.value.liquidity,
              position.value.fee_growth_inside_last.x,
              position.value.fee_growth_inside_last.y
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
    keyId: string,
    owner: string,
    amm: string,
    upperTickIndex: string,
    lowerTickIndex: string,
    liquidity: string,
    feeGrowthInsideLastX: string,
    feeGrowthInsideLastY: string
  ) {
    try {
      const existingPos = await this._dbClient.get({
        select: "*",
        table: "v3_positions",
        where: `key_id = '${keyId}'`,
      });
      if (existingPos.rowCount === 0) {
        console.log("Inserting V3 Position", amm, owner);
        this._dbClient.insert({
          table: "v3_positions",
          columns:
            "(key_id, amm, owner, upper_tick_index, lower_tick_index, liquidity, fee_growth_inside_last_x, fee_growth_inside_last_y)",
          values: `('${keyId}', '${amm}', '${owner}', '${upperTickIndex}', '${lowerTickIndex}', '${liquidity}', '${feeGrowthInsideLastX}', '${feeGrowthInsideLastY}')`,
        });
      } else {
        console.log("Updating V3 Positions", amm, owner);
        this._dbClient.update({
          table: "v3_positions",
          set: `owner='${owner}', upper_tick_index='${upperTickIndex}', lower_tick_index='${lowerTickIndex}', liquidity='${liquidity}', fee_growth_inside_last_x='${feeGrowthInsideLastX}', fee_growth_inside_last_y='${feeGrowthInsideLastY}'`,
          where: `key_id = '${keyId}'`,
        });
      }
    } catch (e) {
      console.log("Error from positions b-", e);
      throw e;
    }
  }

  /*   async updatePositions(level: string): Promise<void> {
    try {
      const pools: Pool[] = (
        await this._dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        })
      ).rows;
      pools.forEach(async (pool) => {
        let offset1 = 0;
        let offset2 = 0;
        while (true) {
          const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
            level,
            bigmapId: pool.derived_bigmap.toString(),
            limit: this._config.tzktLimit,
            offset: offset1,
          });
          if (updates.length === 0) {
            break;
          } else {
            for (const update of updates) {
              const balance = await this._tkztProvider.getLqtBalance({
                bigMap: pool.lqt_token_bigmap,
                address: update.content.key,
              });
              await this._processPosition(
                update.content.key,
                balance,
                pool.amm,
                pool.gauge_bigmap,
                pool.derived_bigmap,
                pool.attach_bigmap,
                update.content.value
              );
            }
            offset1 += this._config.tzktOffset;
          }
        }
        while (true) {
          const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
            level,
            bigmapId: pool.lqt_token_bigmap.toString(),
            limit: this._config.tzktLimit,
            offset: offset2,
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
            offset2 += this._config.tzktOffset;
          }
        }
      });
    } catch (err) {
      console.error("error updating position:", err);
      throw err;
    }
  } */
}
