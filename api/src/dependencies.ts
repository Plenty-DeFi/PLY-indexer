import { readFileSync } from "fs";
import axios from "axios";
import { Config, Dependecies, Data } from "./types";
import TzktProvider from "./infrastructure/TzktProvider";
import DatabaseClient from "./infrastructure/DatabaseClient";
import Cache from "./infrastructure/Cache";

const getDataBuilder = (cache: Cache, config: Config) => async (): Promise<Data> => {
  try {
    let data: Data | undefined = cache.get("tokens");
    //console.log("data", data);
    if (!data) {
      const tokens = (
        await axios.get(config.configURL + "/token?type=standard&network=testnet", {
          //todo change Mainnnet
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          },
        })
      ).data;

      data = {
        tokens: Object.values(tokens),
      };
      cache.insert("tokens", data, config.ttl.data);
    }
    return data;
  } catch (err) {
    throw err;
  }
};

/* const getAPR = (cache: Cache, config: Config) => async (): Promise<APR> => {
  try {
    let apr: APR | undefined = cache.get("apr")?.data;
    if (!data) {
      const tokens = (
        await axios.get(config.configURL + "/token?type=standard&network=testnet", {
          //todo change Mainnnet
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
          },
        })
      ).data;

      data = {
        tokens: Object.values(tokens),
      };
      cache.insert("tokens", data, config.ttl.data);
    }
    return data;
  } catch (err) {
    throw err;
  }
}; */

export const buildDependencies = (config: Config): Dependecies => {
  const cache = new Cache();
  const dbClient = new DatabaseClient(config);
  return {
    cache,
    config,
    dbClient: dbClient,
    tzktProvider: new TzktProvider(config),
    contracts: JSON.parse(readFileSync(`${config.sharedDirectory}/contracts.json`).toString()),
    getData: getDataBuilder(cache, config),
  };
};
