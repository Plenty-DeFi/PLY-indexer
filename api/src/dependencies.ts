import { readFileSync } from "fs";
import axios from "axios";
import { Config, Dependecies, Data, APR, Contracts, Pool } from "./types";
import TzktProvider from "./infrastructure/TzktProvider";
import DatabaseClient from "./infrastructure/DatabaseClient";
import Cache from "./infrastructure/Cache";
import { calculateAPR, calculateFutureAPR, getRealEmission } from "./infrastructure/utils";

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

const getAPR =
  (cache: Cache, config: Config, dbClient: DatabaseClient, tzktProvider: TzktProvider, contracts: Contracts) =>
  async (): Promise<APR> => {
    try {
      let apr: APR | undefined = cache.get("apr");
      if (!apr) {
        apr = {};
        const poolsQuery = await dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        });
        const pools: Pool[] = poolsQuery.rows;
        const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
        const realEmission = await getRealEmission(tzktProvider, contracts);
        for (const pool of pools) {
          const futureApr = await calculateFutureAPR(contracts, tzktProvider, pool, currentEpoch, realEmission);
          const currentApr = await calculateAPR(contracts, tzktProvider, pool, currentEpoch);
          apr[pool.amm] = {
            current: currentApr,
            future: futureApr,
          };
        }
        console.log(apr);
        cache.insert("apr", apr, config.ttl.data);
      }
      return apr;
    } catch (err) {
      throw err;
    }
  };

export const buildDependencies = (config: Config): Dependecies => {
  const cache = new Cache();
  const dbClient = new DatabaseClient(config);
  const tzktProvider = new TzktProvider(config);
  const contracts = JSON.parse(readFileSync(`${config.sharedDirectory}/contracts.json`).toString());
  return {
    cache,
    config,
    dbClient: dbClient,
    tzktProvider: tzktProvider,
    contracts: contracts,
    getData: getDataBuilder(cache, config),
    getAPR: getAPR(cache, config, dbClient, tzktProvider, contracts),
  };
};
