import { readFileSync } from "fs";

import { Config, Dependecies, PoolV2, Token } from "./types";
import TzktProvider from "./infrastructure/TzktProvider";
import DatabaseClient from "./infrastructure/DatabaseClient";
import Cache from "./infrastructure/Cache";
import axios from "axios";
import { entriesToTokens } from "./infrastructure/utils";

export const getPools = (cache: Cache, dbClient: DatabaseClient) => async () => {
  try {
    let data = cache.get("pools");
    //console.log("data", data);
    if (!data) {
      const _entries = await dbClient.getAllNoQuery({
        table: "pool_v2",
        select: "*",
      });

      const tokenEntries = await dbClient.getAllNoQuery({
        table: "token",
        select: "*",
      });

      const tokens = entriesToTokens(tokenEntries, "id");

      const pools: { [key: string]: PoolV2 } = {};

      for (const entry of _entries.rows) {
        pools[entry.address] = {
          address: entry.address,
          token1: tokens[entry.token_1],
          token2: tokens[entry.token_2],
          lpToken: {
            address: entry.lp_token_address,
            decimals: entry.lp_token_decimals,
          },
          fees: entry.fees,
          type: entry.type,
          token1Precision: entry.token1Precision,
          token2Precision: entry.token2Precision,
          gauge: entry.gauge,
          bribe: entry.bribe,
        };
      }

      data = pools;
      cache.insert("pools", data, 60000);
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const getTokens = (cache: Cache, config: Config, dbClient: DatabaseClient) => async () => {
  try {
    let data = cache.get("tokens");
    //console.log("data", data);
    if (!data) {
      const entries = await dbClient.getAllNoQuery({
        table: "token",
        select: "*",
      });

      const tokens = entriesToTokens(entries, "symbol");

      data = Object.values(tokens);
      cache.insert("tokens", data, config.cacheTtl);
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const buildDependencies = (config: Config): Dependecies => {
  const cache = new Cache();
  const dbClient = new DatabaseClient(config);
  return {
    config,
    dbClient: dbClient,
    tzktProvider: new TzktProvider(config),
    contracts: JSON.parse(readFileSync(`${config.sharedDirectory}/contracts.json`).toString()),
    getPools: getPools(cache, dbClient),
    getTokens: getTokens(cache, config, dbClient),
  };
};
