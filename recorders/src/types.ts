import { LargeNumberLike } from "crypto";
import internal from "stream";
import DatabaseClient from "./infrastructure/DatabaseClient";
import TzktProvider from "./infrastructure/TzktProvider";

export interface Config {
  heartbeatURL: string;
  tzktURL: string;
  port: string;
  tzktLimit: number;
  tzktOffset: number;
  sharedDirectory: string;
  tezGraph: string;
  tezGraphWs: string;
  tezGraphLimit: number;
  postgres: {
    username: string;
    database: string;
    password: string;
    host: string;
  };
}

export interface Contracts {
  voteEscrow: {
    address: string;
  };
  ply: {
    address: string;
  };
  veSwap: {
    address: string;
  };
  voter: {
    address: string;
  };
  feeDistributor: {
    address: string;
  };
  bigMaps: {
    locks: number;
    ledger: number;
    attached: number;
    amm_to_gauge_bribe: number;
  };
}

export interface Lock {
  owner: string;
  tokenId: string;
  base_value: string;
  end: string;
  attached: boolean;
}

export interface LocksQueryVariable {
  id: string;
  limit: number;
  after?: string;
  keys?: string[];
}

export interface LockValues {
  base_value: string;
  end: string;
}

export interface Dependecies {
  config: Config;
  dbClient: DatabaseClient;
  tzktProvider: TzktProvider;
  contracts: Contracts;
}

export interface BlockData {
  hash: string;
  timestamp: string;
}

export interface DatabaseGetParams {
  table: string;
  select: string;
  where: string;
}
export interface DatabaseDeleteParams {
  table: string;
  where: string;
}

export interface DatabaseInsertParams {
  table: string;
  columns: string;
  values: string;
}

export interface PoolsApiResponse {
  key: string;
  value: {
    gauge: string;
    bribe: string;
  };
}

export interface DatabaseUpdateParams {
  table: string;
  set: string;
  where: string;
}

export interface GetTransactionParameters {
  contract: string;
  entrypoint: string[];
  firstLevel: number;
  lastLevel: number;
  limit: number;
  offset: number;
  select: string;
}

export interface GetBigMapUpdatesParameters {
  bigmapId: string;
  level: string;
  limit: number;
  offset: number;
}

export interface BigMapUpdateResponseType {
  id: number;
  level: number;
  timestamp: string;
  bigmap: number;
  action: string;
  content?: {
    key: any;
    value: any;
  };
}

export interface Transaction {
  id: number;
  level: number;
  hash: number;
  timestamp: string;
  sender: {
    address: string;
  };
  target:
    | {
        address: string;
      }
    | undefined;
  initiator:
    | {
        address: string;
      }
    | undefined;
  amount: number;
  parameter:
    | {
        entrypoint: string;
        value: any;
      }
    | undefined;
  storage: any;
}

export interface BlockData {
  hash: string;
  timestamp: string;
  level: string;
}
