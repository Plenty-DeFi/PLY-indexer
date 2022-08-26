import qs from "qs";
import axios from "axios";

import {
  BribeApiResponse,
  Config,
  GetBigMapUpdatesParameters,
  GetTransactionParameters,
  PoolsApiResponse,
  Transaction,
} from "../types";

export default class TzktProvider {
  private _tzktURL: string;

  constructor({ tzktURL }: Config) {
    this._tzktURL = tzktURL;
  }

  async getTransactions<T>(params: GetTransactionParameters): Promise<T> {
    try {
      const res = await axios.get(`${this._tzktURL}/operations/transactions`, {
        params: {
          target: params.contract,
          entrypoint: params.entrypoint,
          ["level.ge"]: params.firstLevel,
          ["level.le"]: params.lastLevel,
          select: params.select,
          limit: params.limit,
          offset: params.offset,
          status: "applied",
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });
      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getBigMapUpdates<T>(params: GetBigMapUpdatesParameters): Promise<T> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/updates`, {
        params: {
          bigmap: params.bigmapId,
          level: params.level,
          limit: params.limit,
          offset: params.offset,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });
      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getLedgerData<T>(params: { tokenIds: string[]; bigMap: string; limit: number; offset: number }): Promise<T> {
    try {
      if (params.tokenIds.length > 1) {
        const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
          params: {
            select: "key,value",
            ["key.nat.in"]: params.tokenIds.join(","),
            limit: params.limit,
            offset: params.offset,
          },
          paramsSerializer: (params) => {
            return qs.stringify(params, { arrayFormat: "repeat" });
          },
        });

        return res.data;
      } else {
        const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
          params: {
            select: "key,value",
            ["key.nat"]: params.tokenIds[0],
            limit: params.limit,
            offset: params.offset,
          },
          paramsSerializer: (params) => {
            return qs.stringify(params, { arrayFormat: "repeat" });
          },
        });

        return res.data;
      }
    } catch (err) {
      throw err;
    }
  }

  async getPools<T>(bigMap: string): Promise<PoolsApiResponse[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${bigMap}/keys`, {
        params: {
          select: "key,value",
          active: "true",
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getAmmData<T>(amm: string): Promise<{
    token1Address: string;
    token2Address: string;
    lqtTokenAddress: string;
    token1Check: boolean;
    token2Check: boolean;
    token1Id: string;
    token2Id: string;
  }> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${amm}/storage`, {
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return {
        token1Address: res.data.token1Address,
        token2Address: res.data.token2Address,
        lqtTokenAddress: res.data.lqtAddress ? res.data.lqtAddress : res.data.lpTokenAddress,
        token1Check: res.data.token1Check,
        token2Check: res.data.token2Check,
        token1Id: res.data.token1Id,
        token2Id: res.data.token2Id,
      };
    } catch (err) {
      throw err;
    }
  }

  async getLqtBigMap<T>(lqtAddress: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${lqtAddress}/storage`, {
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data.balances.toString();
    } catch (err) {
      throw err;
    }
  }

  async getGaugeBigMap<T>(gauge: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${gauge}/storage`, {
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data.balances.toString();
    } catch (err) {
      throw err;
    }
  }

  async getBribeBigMap<T>(bribe: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${bribe}/storage`, {
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data.epoch_bribes.toString();
    } catch (err) {
      throw err;
    }
  }

  async getBribes(params: { bigMap: string; limit: number; offset: number }): Promise<BribeApiResponse[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          limit: params.limit,
          offset: params.offset,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getOperation(hash: string): Promise<Transaction[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/operations/${hash}`);
      return res.data;
    } catch (err) {
      throw err;
    }
  }
}
