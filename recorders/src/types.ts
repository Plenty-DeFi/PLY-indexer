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
  configUrl: string;
  networkIndexer: string;
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
    total_amm_votes: number;
    total_epoch_votes: number;
    total_token_votes: number;
    token_amm_votes: number;
    amm_epoch_fee: number;
    fee_claim_ledger: number;
    epoch_end: number;
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
  where?: string;
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

export interface DatabaseInsertUpdateParams {
  table: string;
  columns: string;
  values: string;
  update: string;
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

export enum TokenVariant {
  TEZ = "TEZ",
  FA12 = "FA1.2",
  FA2 = "FA2",
}

export interface Token {
  address: string | undefined;
  symbol: string;
  variant: TokenVariant;
  tokenId: number | undefined;
  decimals: number;
}

export interface Tokens {
  [key: string]: Token;
}

export enum AmmType {
  STABLE = "STABLE",
  VOLATILE = "VOLATILE",
}

export interface AmmData {
  address: string;
  token1: Token;
  token2: Token;
  type: AmmType;
  lqtAddress: string;
  lqtSymbol: string;
  lqtBigMap: string;
  lqtDecimals: number;
}

export interface BribeApiResponse {
  key: {
    epoch: string;
    bribe_id: string;
  };
  value: {
    bribe: {
      type: TokenType;
      value: string;
    };
    provider: string;
  };
}

export interface LqtBalancesApiResponse {
  key: string;
  value: {
    balance: string;
  };
}

export interface TotalAmmVotes {
  key: {
    amm: string;
    epoch: string;
  };
  value: string;
}

export interface TokenAmmVotes {
  key: {
    amm: string;
    epoch: string;
    token_id: string;
  };
  value: string;
}
export interface FeesApiResponse {
  key: {
    amm: string;
    epoch: string;
  };
  value: FeeValue[];
}

export interface FeeValue {
  key: TokenType;
  value: string;
}
export interface BribeApiResponse {
  key: {
    epoch: string;
    bribe_id: string;
  };
  value: {
    bribe: {
      type: TokenType;
      value: string;
    };
    provider: string;
  };
}

export interface TokenType {
  fa2?: {
    nat: string;
    address: string;
  };
  fa12?: string;
  tez?: {};
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
  attach_bigmap: string;
  derived_bigmap: string;
  bribe_claim_ledger: string;
}
