import qs from "qs";
import axios from "axios";

import {
  BribeApiResponse,
  Config,
  GetBigMapUpdatesParameters,
  GetTransactionParameters,
  LqtBalancesApiResponse,
  PoolsApiResponse,
  TotalAmmVotes,
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

  async getLockValues<T>(params: { bigmap: string; tokenId: string }): Promise<T> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigmap}/keys`, {
        params: {
          select: "key,value",
          key: params.tokenId,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });
      return res.data[0];
    } catch (err) {
      throw err;
    }
  }

  async getLocks<T>(params: { bigMap: string; limit: number; offset: number }): Promise<T> {
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

  async getLockAttached<T>(params: { bigmap: string; tokenId: string }): Promise<T> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigmap}/keys`, {
        params: {
          select: "key,value,active",
          key: params.tokenId,
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

  async getGaugeBigMap<T>(gauge: string): Promise<{
    gaugeBigMap: string;
    attachBigMap: string;
    derivedBigMap: string;
  }> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${gauge}/storage`, {
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return {
        gaugeBigMap: res.data.balances.toString(),
        attachBigMap: res.data.attached_tokens.toString(),
        derivedBigMap: res.data.derived_balances.toString(),
      };
    } catch (err) {
      throw err;
    }
  }

  async getBribeBigMap<T>(bribe: string): Promise<{ bribeBigMap: string; bribeClaimLedgerBigMap: string }> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${bribe}/storage`, {
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return {
        bribeBigMap: res.data.epoch_bribes.toString(),
        bribeClaimLedgerBigMap: res.data.claim_ledger.toString(),
      };
    } catch (err) {
      throw err;
    }
  }

  async getLqtBalances(params: { bigMap: string; limit: number; offset: number }): Promise<LqtBalancesApiResponse[]> {
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

  async getLockTs(params: { bigMap: string; token_id: string }): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          ["key.nat_0"]: params.token_id,
          ["key.nat_1"]: "1",
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data[0].value.ts.toString();
    } catch (err) {
      throw err;
    }
  }

  async getBlock(params: { ts: string }): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/blocks/${params.ts}`);
      return res.data.level.toString();
    } catch (err) {
      throw err;
    }
  }

  async getEpochfromLevel<T>(voter: string, block: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${voter}/storage`, {
        params: {
          ["level"]: block,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data.epoch.toString();
    } catch (err) {
      throw err;
    }
  }

  async getClaimedEpochs(params: {
    bigMap: string;
    token_id: string;
    limit: number;
    offset: number;
  }): Promise<string[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          ["key.token_id"]: params.token_id,
          limit: params.limit,
          offset: params.offset,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });

      return res.data.map((x: any) => x.key.epoch.toString());
    } catch (err) {
      throw err;
    }
  }

  async getEpochInflation(bigmap: string, epoch: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${bigmap}/keys`, {
        params: {
          select: "key,value",
          ["key"]: epoch,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });
      if (res.data.length === 0) {
        return "0";
      } else {
        return res.data[0].value;
      }
    } catch (err) {
      throw err;
    }
  }

  async getBigMap(params: { bigMap: string; limit: number; offset: number }): Promise<[]> {
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

  async getFeeClaimed<T>(params: { bigMap: string; epoch: string; token_id: string; amm: string }): Promise<[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          ["key.epoch"]: params.epoch,
          ["key.token_id"]: params.token_id,
          ["key.amm"]: params.amm,
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

  async getBribeClaimed<T>(params: { bigMap: string; bribe_id: string; token_id: string }): Promise<[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          ["key.token_id"]: params.token_id,
          ["key.bribe_id"]: params.bribe_id,
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

  async getEpochTotalAmmVotes<T>(params: {
    bigMap: string;
    limit: number;
    offset: number;
    epoch: string;
  }): Promise<[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          ["key.epoch"]: params.epoch,
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

  async getStakeBalance(params: { bigMap: string; address: string }): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMap}/keys`, {
        params: {
          select: "key,value",
          key: params.address,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });
      if (res.data.length > 0) {
        return res.data[0].value;
      } else {
        return "0";
      }
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
