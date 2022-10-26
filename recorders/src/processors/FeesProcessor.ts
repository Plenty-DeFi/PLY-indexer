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
  FeesApiResponse,
} from "../types";

export default class FeesProcessor {
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
      const tokens = await getTokens(this._config);
      console.log("Fees processing started");
      let offset = 0;
      while (true) {
        const fees: FeesApiResponse[] = await this._tkztProvider.getBigMap({
          bigMap: this._contracts.bigMaps.amm_epoch_fee.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (fees.length === 0) {
          break;
        } else {
          for (const fee of fees) {
            await this._processFees(fee, tokens);
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error from Fees processing", e);
    }
  }

  private async _processFees(fee: FeesApiResponse, tokens: Token[]) {
    try {
      const token1Symbol = getTokenSymbol(fee.value[0].key, tokens);
      const token2Symbol = getTokenSymbol(fee.value[1].key, tokens);

      console.log(
        "Inserting Fees",
        fee.key.amm,
        fee.key.epoch,
        token1Symbol,
        fee.value[0].value,
        token2Symbol,
        fee.value[1].value
      );
      await this._dbClient.insert({
        table: "fees",
        columns: "(amm, epoch, token1_symbol, token1_fee, token2_symbol, token2_fee)",
        values: `('${fee.key.amm}', '${fee.key.epoch}', '${token1Symbol}', '${fee.value[0].value}', '${token2Symbol}', '${fee.value[1].value}')`,
      });
    } catch (e) {
      console.log("Error from fees processing db ", e);
      throw e;
    }
  }

  async updateFees(level: string): Promise<void> {
    try {
      const tokens = await getTokens(this._config);
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.amm_epoch_fee.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          for (const update of updates) {
            if (update.action === "add_key") {
              await this._processFees(update.content, tokens);
            }
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error from update fees:", err);
      throw err;
    }
  }
}
