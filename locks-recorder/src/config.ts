import { Config } from "./types";

export const config: Config = {
  heartbeatURL: process.env.HEARTBEAT || "https://cronitor.link/p/f2b147ded5de476180d0eac01c1502f6/EADGAa",
  tzktURL: process.env.TZKT_URL || "https://api.ithacanet.tzkt.io/v1",
  port: process.env.PORTS || "6024",
  tzktLimit: 1000,
  tezGraphLimit: 10,
  tzktOffset: 1000,
  sharedDirectory: process.env.SHARED_DIRECTORY || "./data",
  postgres: {
    username: process.env.POSTGRES_USER || "master",
    database: process.env.POSTGRES_DB || "plenty",
    password: process.env.POSTGRES_PASSWORD || "123456",
    host: process.env.POSTGRES_HOST || "localhost",
  },
  tezGraph: process.env.TZGRAPH_URL || "https://ithacanet.tezgraph.tez.ie/graphql",
  tezGraphWs: process.env.TZGRAPH_WS || "wss://ithacanet.tezgraph.tez.ie/graphql",
};
