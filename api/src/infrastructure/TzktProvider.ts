import * as qs from "qs";
import axios from "axios";

import {
  AlltokenCheckpoints,
  Config,
  GetTransactionParameters,
  GetUnclaimedEpochParameters,
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

  async getUnclaimedEpochs(params: GetUnclaimedEpochParameters): Promise<number[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${params.bigMapId}/keys`, {
        params: {
          ["key.token_id"]: params.tokenId,
        },
        paramsSerializer: (params) => {
          return qs.stringify(params, { arrayFormat: "repeat" });
        },
      });
      const unclaimedEpochs: number[] = [];
      const claimedEpochs = res.data.map((data: any) => {
        return data.key.epoch;
      });
      let i = params.currentEpoch;
      return new Promise((resolve, reject) => {
        while (i > 0) {
          if (!claimedEpochs.includes(i)) {
            unclaimedEpochs.push(i);
          }
          i--;
          if (i === 0) {
            resolve(unclaimedEpochs);
            break;
          }
        }
      });
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

  async getCurrentEpoch(voter: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${voter}/storage`);
      return res.data.epoch;
    } catch (err) {
      throw err;
    }
  }

  async getCurrentTotalSupply(ply: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${ply}/storage`);
      return res.data.totalSupply;
    } catch (err) {
      throw err;
    }
  }

  async getLockedSupply(ve: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${ve}/storage`);
      return res.data.locked_supply;
    } catch (err) {
      throw err;
    }
  }

  async getEmissionData(voter: string): Promise<{ base: string; real: string; genesis: string }> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${voter}/storage`);
      return res.data.emission;
    } catch (err) {
      throw err;
    }
  }

  async getAmmVotes(bigmap: string, epoch: string, amm: string): Promise<string> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${bigmap}/keys`, {
        params: {
          select: "key,value",
          ["key.epoch"]: epoch,
          ["key.amm"]: amm,
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

  async getEpochVotes(bigmap: string, epoch: string): Promise<string> {
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

  async getAmmPoolValues(amm: string): Promise<{ token1Pool: string; token2Pool: string }> {
    try {
      const res = await axios.get(`${this._tzktURL}/contracts/${amm}/storage`);
      return {
        token1Pool: res.data.token1Pool || res.data.token1_pool || res.data.tezPool,
        token2Pool: res.data.token2Pool || res.data.token2_pool || res.data.ctezPool,
      };
    } catch (err) {
      throw err;
    }
  }

  async getBribes(bigmap: string, epoch: string): Promise<[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/bigmaps/${bigmap}/keys`, {
        params: {
          select: "key,value",
          ["key.epoch"]: epoch,
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

//   Call VE Storage to get map ID
  async getAllTokenCheckpoints(tokenId: number): Promise<AlltokenCheckpoints[]> {
    try {
      // mapid variable
      const res = await axios.get(`${this._tzktURL}/bigmaps/160226/keys?key.nat_0="${tokenId}"&select=key,value`);
      if (res.data.length === 0) {
        throw "Lock does not exist";
      }
      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getNumTokenCheckpoints(tokenId: number): Promise<string> {
    try {
      // mapid variable
      const res = await axios.get(`${this._tzktURL}/bigmaps/160223/keys/${tokenId}`);
      if (res.status === 204) {
        throw "Lock does not exist";
      }
      return res.data.value;
    } catch (err) {
      throw err;
    }
  }
}
