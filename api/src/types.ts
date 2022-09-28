import Cache from "./infrastructure/Cache";
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
  tezGraphLimit: number;
  rpc: string;
  postgres: {
    username: string;
    database: string;
    password: string;
    host: string;
  };
  ttl: {
    data: number;
    history: number;
  };
  configURL: string;
}

export interface Data {
  tokens: Token[];
}

export interface Token {
  address: string;
  symbol: string;
  variant: string;
  tokenId: number;
}

export interface APR {
  [key: string]: string;
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
    claim_ledger: number;
    amm_to_gauge_bribe: number;
    total_amm_votes: number;
    total_epoch_votes: number;
    total_token_votes: number;
    epoch_end: number;
    epoch_inflation: number;
    global_checkpoints: number;
  };
  EMISSION_FACTOR: number;
}

export interface Lock {
  owner: string;
  id: string;
  baseValue: string;
  endTs: string;
  attached: boolean;
  epochtVotingPower: string;
  currentVotingPower: string;
  availableVotingPower: string;
}

export interface Pool {
  amm: string;
  lqt_token: string;
  token1: string;
  token2: string;
  token1_decimals: number;
  token2_decimals: number;
  token1_variant: boolean;
  token2_variant: boolean;
  token1_symbol: string;
  token2_symbol: string;
  token1_id: number | undefined;
  token2_id: number | undefined;
  lqt_token_bigmap: string;
  gauge: string;
  bribe: string;
  gauge_bigmap: string;
  bribe_bigmap: string;
}

export interface LocksQueryVariable {
  id: string;
  limit: number;
  after?: string;
}

export interface LockValues {
  base_value: string;
  end: string;
}

export interface Dependecies {
  cache: Cache;
  config: Config;
  dbClient: DatabaseClient;
  tzktProvider: TzktProvider;
  contracts: Contracts;
  getData: () => Promise<Data>;
  getAPR: () => Promise<APR>;
}

export interface BlockData {
  hash: string;
  timestamp: string;
}

export interface DatabaseGetParams {
  table: string;
  select: string;
  where?: string;
}

export interface DatabaseInsertParams {
  table: string;
  columns: string;
  values: string;
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

export interface GetUnclaimedEpochParameters {
  bigMapId: string;
  tokenId: string;
  currentEpoch: number;
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

export interface AlltokenCheckpoints {
  key: AlltokenCheckpoints_Key;
  value: AlltokenCheckpoints_Value;
}
export interface AlltokenCheckpoints_Key {
  nat_0: string;
  nat_1: string;
}
export interface AlltokenCheckpoints_Value {
  ts: string;
  bias: string;
  slope: string;
}

export interface CachedValue {
  data: any;
  storedAt: Date | undefined;
  ttl: number | undefined;
}

export interface TokenType {
  fa2?: {
    nat: string;
    address: string;
  };
  fa12?: string;
  tez?: {};
}
