import { Config } from "./types";

export const config: Config = {
  heartbeatURL: process.env.HEARTBEAT || "https://cronitor.link/p/f2b147ded5de476180d0eac01c1502f6/EADGAa",
  tzktURL: process.env.TZKT_URL || "https://api.ghostnet.tzkt.io/v1",
  port: process.env.PORTS || "6024",
  tzktLimit: 1000,
  tzktOffset: 1000,
  sharedDirectory: process.env.SHARED_DIRECTORY || "./data",
  postgres: {
    username: process.env.POSTGRES_USER || "master",
    database: process.env.POSTGRES_DB || "plenty",
    password: process.env.POSTGRES_PASSWORD || "123456",
    host: process.env.POSTGRES_HOST || "localhost",
  },

  rpc: process.env.RPC || "https://tezosrpc.midl.dev/ak-8zzygk8qh8iyb2",
  startingBlock: process.env.STARTING_BLOCK || "3843106",
  initialIndexing: process.env.INITIAL_INDEXING || "true", //"true" or "false",
  cacheTtl: parseInt(process.env.CACHE_TTL) || 300000,
};
