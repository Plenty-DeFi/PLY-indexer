import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import { Config, Dependecies, Contracts, PoolsApiResponse, BigMapUpdateResponseType } from "../types";

export default class PoolsProcessor {
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

  async process(): Promise<void> {
    try {
      const pools: PoolsApiResponse[] = await this._tkztProvider.getPools(
        this._contracts.bigMaps.amm_to_gauge_bribe.toString()
      );
      console.log(pools);
      for (const pool of pools) {
        const existingEntry = await this._dbClient.get({
          select: "*",
          table: "pools",
          where: `amm='${pool.key}'`,
        });
        if (existingEntry.rowCount === 0) {
          await this._processPool(pool);
        }
      }
    } catch (e) {
      console.log(e);
    }
  }
  private async _processPool(pool: PoolsApiResponse): Promise<void> {
    try {
      //get AMM data (lqtTokenAddress, token1Address and token2Address)
      const ammData = await this._tkztProvider.getAmmData(pool.key);
      //get lqtTokenBigMap
      const lqtBigMap = await this._tkztProvider.getLqtBigMap(ammData.lqtTokenAddress);
      //get gaugeBigMap
      const gaugeBigMap = await this._tkztProvider.getGaugeBigMap(pool.value.gauge);
      //get bribeBigMap
      const bribeBigMap = await this._tkztProvider.getBribeBigMap(pool.value.bribe);
      //save in db
      console.log(`Inseting Pool ${pool.key}`);
      this._dbClient.insert({
        table: "pools",
        columns:
          "(amm, lqt_Token, token1, token2, token1_Check, token2_Check, token1_Id, token2_Id, lqt_Token_BigMap, gauge, bribe, gauge_BigMap, bribe_BigMap)",
        values: `('${pool.key}', '${ammData.lqtTokenAddress}', '${ammData.token1Address}', '${ammData.token2Address}', ${ammData.token1Check}, ${ammData.token2Check}, ${ammData.token1Id}, ${ammData.token2Id}, '${lqtBigMap}', '${pool.value.gauge}', '${pool.value.bribe}', '${gaugeBigMap}', '${bribeBigMap}')`,
      });
    } catch (e) {
      console.log(e);
    }
  }

  async updatePools(level: string): Promise<void> {
    try {
      let tokenIdUpdates: string[] = [];
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
  }
}
