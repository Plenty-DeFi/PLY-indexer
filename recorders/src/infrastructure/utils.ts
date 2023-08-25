import axios from "axios";
import { Config, PoolV3, Token, Token2, TokenType, V3Pools } from "../types";
import { TezosToolkit } from "@taquito/taquito";
import { RpcClient } from "@taquito/rpc";
import { HttpBackend } from "@taquito/http-utils";
import qs from "qs";
import DatabaseClient from "./DatabaseClient";
import { QueryResult } from "pg";

export const getTokenSymbol = (type: TokenType, tokens: Token[]): string => {
  if (type.hasOwnProperty("fa2")) {
    return tokens.find((x) => x.address == type.fa2.address && x.tokenId.toString() == type.fa2.nat.toString()).symbol;
  } else if (type.hasOwnProperty("fa12")) {
    return tokens.find((x) => x.address == type.fa12).symbol;
  } else {
    return "XTZ";
  }
};

/* export const totalVotingPower = async (
  ts2: number,
  time: number,
  global_checkpoints: Map<string, { ts: string; bias: string; slope: string }>,
  dbClient: DatabaseClient
) => {
  try {
    let factor: number = 7 * 480;
    if (time === 0) {
      factor = 1;
    }
    // Must round down to nearest whole week
    ts2 = Math.floor(ts2 / factor) * factor;
    const ts = new BigNumber(ts2);
    const gc_index = global_checkpoints.size;

    if (parseInt(ts.toFixed(0)) < parseInt(global_checkpoints.get("1").ts)) {
      throw "0";
    }

    let c_cp = global_checkpoints.get(gc_index.toString());

    if (parseInt(ts.toFixed(0)) < parseInt(c_cp.ts)) {
      let high = gc_index - 2;
      let low = 0;
      let mid = 0;
      while (low < high && parseInt(global_checkpoints.get((mid + 1).toString()).ts) != parseInt(ts.toFixed(0))) {
        mid = Math.floor((low + high + 1) / 2);
        if (parseInt(global_checkpoints.get((mid + 1).toString()).ts) < parseInt(ts.toFixed(0))) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }
      if (parseInt(global_checkpoints.get((mid + 1).toString()).ts) === parseInt(ts.toFixed(0))) {
        c_cp = global_checkpoints.get((mid + 1).toString());
      } else {
        c_cp = global_checkpoints.get((low + 1).toString());
      }
    }
    let c_bias = new BigNumber(c_cp.bias);
    let c_slope = new BigNumber(c_cp.slope);
    let n_ts = new BigNumber(c_cp.ts).plus(7 * 480); //todo change later
    let c_ts = new BigNumber(c_cp.ts);

    if (n_ts.isLessThan(ts)) {
      while (n_ts.isLessThan(ts) && !c_bias.isEqualTo(0)) {
        const d_ts = n_ts.minus(c_ts);
        c_bias = c_bias.minus(c_slope.times(d_ts)).dividedBy(10 ** 18);
        const slope_changesData = await dbClient.get({
          select: "*",
          table: "slopes",
          where: `ts='${n_ts.toFixed(0)}'`,
        });
        let slope_changes;
        if (slope_changesData.rowCount > 0) {
          slope_changes = new BigNumber(slope_changesData.rows[0].slope);
        } else {
          slope_changes = new BigNumber(0);
        }

        c_slope = c_slope.minus(slope_changes);

        c_ts = n_ts;
        n_ts = n_ts.plus(7 * 480); //todo change later
      }
    }
    if (!c_bias.isEqualTo(0)) {
      const d_ts = ts.minus(c_ts);
      c_bias = c_bias.minus(c_slope.times(d_ts)).dividedBy(10 ** 18);
    }

    return c_bias.toFixed(0);
  } catch (e) {
    console.log(e);
    return e;
  }
}; */

export const totalVotingPower = async (params: { rpc: string; ts: string; voteEscrow: string }) => {
  try {
    const tezos = new TezosToolkit(new RpcClient(params.rpc, "main", new HttpBackend(100000)));
    const contract = await tezos.contract.at(params.voteEscrow);
    const totalVotingPower = await contract.contractViews
      .get_total_voting_power({ ts: params.ts, time: 1 })
      .executeView({ viewCaller: "KT1H7Bg7r7Aa9sci2hoJtmTdS7W64aq4vev8" });
    return totalVotingPower.toString();
  } catch (e) {
    return "0";
  }
};

export const asyncFilter = async (arr: any[], predicate: any) => {
  const results = await Promise.all(arr.map(predicate));

  return arr.filter((_v, index) => results[index]);
};

export const entriesToTokens = (entries: QueryResult, indexBy: string) => {
  const tokens: { [key: string]: Token2 } = {};

  for (const entry of entries.rows) {
    tokens[entry[indexBy]] = {
      id: parseInt(entry.id),
      name: entry.name,
      symbol: entry.symbol,
      decimals: parseInt(entry.decimals),
      standard: entry.standard,
      address: entry.address,
      tokenId: entry.token_id ? parseInt(entry.token_id) : undefined,
      thumbnailUri: entry.thumbnail_uri,
      originChain: entry.origin_chain,
    };
  }

  return tokens;
};

export const getV3Pools: (dbClient: DatabaseClient) => Promise<{ [key: string]: PoolV3 }> = async (
  dbClient: DatabaseClient
) => {
  try {
    const _entries = await dbClient.getAllNoQuery({
      table: "pool_v3",
      select: "*",
    });

    const tokenEntries = await dbClient.getAllNoQuery({
      table: "token",
      select: "*",
    });

    const tokens = entriesToTokens(tokenEntries, "id");

    const pools: { [key: string]: PoolV3 } = {};

    for (const entry of _entries.rows) {
      pools[entry.address] = {
        address: entry.address,
        tokenX: tokens[entry.token_x],
        tokenY: tokens[entry.token_y],
        feeBps: entry.fee_bps,
        gauge: entry.gauge,
        bribe: entry.bribe,
      };
    }

    return pools;
  } catch (err) {
    throw err;
  }
};
