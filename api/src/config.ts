import { Config } from "./types";

export const config: Config = {
  heartbeatURL: process.env.HEARTBEAT || "https://cronitor.link/p/f2b147ded5de476180d0eac01c1502f6/EADGAa",
  tzktURL: process.env.TZKT_URL || "https://api.ghostnet.tzkt.io/v1",
  port: process.env.PORTS || "3000",
  tzktLimit: 1000,
  tezGraphLimit: 1,
  tzktOffset: 1000,
  sharedDirectory: process.env.SHARED_DIRECTORY || "./data",
  postgres: {
    username: process.env.POSTGRES_USER || "master",
    database: process.env.POSTGRES_DB || "plenty",
    password: process.env.POSTGRES_PASSWORD || "123456",
    host: process.env.POSTGRES_HOST || "localhost",
  },
  tezGraph: process.env.TZGRAPH_URL || "https://ghostnet.tezgraph.ecadinfra.com/graphql",
  rpc: process.env.RPC || "https://rpc.tzkt.io/ghostnet",

  ttl: {
    data: parseInt(process.env.DATA_TTL) || 300000,
    history: parseInt(process.env.HISTORY_TTL) || 0,
  },
  configURL: process.env.CONFIG_URL || "https://config.plenty.network/v1/config",
};
