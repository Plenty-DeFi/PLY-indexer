import * as qs from "qs";
import axios from "axios";

import { AlltokenCheckpoints, Config, GetTransactionParameters, Transaction} from "../types";

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

  async getOperation(hash: string): Promise<Transaction[]> {
    try {
      const res = await axios.get(`${this._tzktURL}/operations/${hash}`);
      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getAllTokenCheckpoints(tokenId: number): Promise<AlltokenCheckpoints[]> {
    try {
      // mapid variable
      const res = await axios.get(`${this._tzktURL}/bigmaps/121552/keys?key.nat_0="${tokenId}"&select=key,value`);
      if(res.data.length === 0) {throw "Lock does not exist";}
      return res.data;
    } catch (err) {
      throw err;
    }
  }

  async getNumTokenCheckpoints(tokenId: number): Promise<string> {
    try {
      // mapid variable
      const res = await axios.get(`${this._tzktURL}/bigmaps/121549/keys/${tokenId}`);
      if(res.status === 204){throw "Lock does not exist";}
      return res.data.value;
    } catch (err) {
      throw err;
    }
  }



  



 
}
