import { readFileSync } from "fs";

import { Config, Dependecies, Token } from "./types";
import TzktProvider from "./infrastructure/TzktProvider";
import DatabaseClient from "./infrastructure/DatabaseClient";
import Cache from "./infrastructure/Cache";
import axios from "axios";

export const getPools = (cache: Cache, config: Config) => async () => {
  try {
    let data = cache.get("pools");
    //console.log("data", data);
    if (!data) {
      const pools = (
        await axios.get(config.configUrl + "/pools", {
          //todo reconfigure later
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          },
        })
      ).data;

      data = pools;
      cache.insert("pools", data, 60000);
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const getTokens = (cache: Cache, config: Config) => async () => {
  try {
    let data = cache.get("tokens");
    //console.log("data", data);
    if (!data) {
      const tokens = (
        await axios.get(config.configUrl + "/tokens", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          },
        })
      ).data;

      data = Object.values(tokens);
      cache.insert("tokens", data, config.cacheTtl);
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const getTokenPrice = (cache: Cache, config: Config) => async () => {
  try {
    let data = cache.get("prices");
    //console.log("data", data);
    if (!data) {
      const tokens = (
        await axios.get(config.networkIndexer + "/analytics/tokens", {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          },
        })
      ).data;

      data = tokens;
      cache.insert("prices", data, config.cacheTtl);
    }
    return data;
  } catch (err) {
    throw err;
  }
};

export const buildDependencies = (config: Config): Dependecies => {
  const cache = new Cache();
  return {
    config,
    dbClient: new DatabaseClient(config),
    tzktProvider: new TzktProvider(config),
    contracts: JSON.parse(readFileSync(`${config.sharedDirectory}/contracts.json`).toString()),
    getPools: getPools(cache, config),
    getTokens: getTokens(cache, config),
    getTokenPrice: getTokenPrice(cache, config),
  };
};
