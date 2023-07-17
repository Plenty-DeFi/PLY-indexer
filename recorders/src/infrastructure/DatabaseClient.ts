import { Client, QueryResult } from "pg";

import {
  Config,
  DatabaseDeleteParams,
  DatabaseGetParams,
  DatabaseInsertParams,
  DatabaseInsertUpdateParams,
  DatabaseUpdateParams,
} from "../types";

export default class DatabaseClient {
  private _dbClient: Client;

  constructor(config: Config) {
    this._dbClient = new Client({
      user: config.postgres.username,
      host: config.postgres.host,
      database: config.postgres.database,
      password: config.postgres.password,
      port: 5432,
    });
  }

  async init(): Promise<void> {
    try {
      this._dbClient.connect();
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS locks (
          id NUMERIC PRIMARY KEY,
          owner VARCHAR(50) NOT NULL,
          base_value VARCHAR(100) NOT NULL,
          end_ts VARCHAR(100) NOT NULL,
          attached BOOLEAN NOT NULL,
          epoch VARCHAR(50) NOT NULL,
          claimed_epochs VARCHAR(50)[] NOT NULL
        );`
      );
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS pools (
          amm VARCHAR(50) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          lqt_decimals NUMERIC NOT NULL,
          lqt_Token VARCHAR(50) NOT NULL,
          token1 VARCHAR(50),
          token2 VARCHAR(50),
          token1_variant VARCHAR(50) NOT NULL,
          token2_variant VARCHAR(50) NOT NULL,
          token1_decimals NUMERIC NOT NULL,
          token2_decimals NUMERIC NOT NULL,
          token1_symbol VARCHAR(50) NOT NULL,
          token2_symbol VARCHAR(50) NOT NULL,
          token1_Id NUMERIC,
          token2_Id NUMERIC,
          lqt_Token_BigMap VARCHAR(100) NOT NULL,
          gauge VARCHAR(50) NOT NULL,
          bribe VARCHAR(50) NOT NULL,
          gauge_BigMap VARCHAR(100) NOT NULL,
          attach_BigMap VARCHAR(100) NOT NULL,
          derived_BigMap VARCHAR(100) NOT NULL,
          bribe_BigMap VARCHAR(100) NOT NULL,
          bribe_claim_ledger VARCHAR(100) NOT NULL
        );`
      );

      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS v3_pools (
          amm VARCHAR(50) PRIMARY KEY,
          fee_bps VARCHAR(50) NOT NULL,
          token1 VARCHAR(50),
          token2 VARCHAR(50),
          token1_variant VARCHAR(50) NOT NULL,
          token2_variant VARCHAR(50) NOT NULL,
          token1_decimals NUMERIC NOT NULL,
          token2_decimals NUMERIC NOT NULL,
          token1_symbol VARCHAR(50) NOT NULL,
          token2_symbol VARCHAR(50) NOT NULL,
          token1_Id NUMERIC,
          token2_Id NUMERIC,
          positions_BigMap VARCHAR(100) NOT NULL
        );`
      );
      /*       {
        "KT1M5yHd85ikngHm5YCu9gkfM2oqtbsKak8Y": {
        "address": "KT1M5yHd85ikngHm5YCu9gkfM2oqtbsKak8Y",
        "tokenX": {
        "name": "Ethereum DAI",
        "symbol": "DAI.e",
        "decimals": "18",
        "standard": "FA2",
        "address": "KT1Uw1oio434UoWFuZTNKFgt5wTM9tfuf7m7",
        "tokenId": "5",
        "thumbnailUri": "ipfs://bafybeicqbt2gepdljrjpcsaypkyjhbmuvra6jkpcwmmw6qgtwfu7dcdezy",
        "originChain": "ETHEREUM"
        },
        "tokenY": {
        "name": "Ethereum USDC",
        "symbol": "USDC.e",
        "decimals": "6",
        "standard": "FA2",
        "address": "KT1Uw1oio434UoWFuZTNKFgt5wTM9tfuf7m7",
        "tokenId": "2",
        "thumbnailUri": "ipfs://bafybeic4zn6dqvbzfdsnlr7hbmddpl65i6hfmt6b2dppjxy3tako3vmovy",
        "originChain": "ETHEREUM"
        },
        "feeBps": "5",
        "gauge": null,
        "bribe": null
        }
        } */
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS bribes (
          amm VARCHAR(50) NOT NULL,
          epoch VARCHAR(50) NOT NULL,
          bribe_id VARCHAR(50) NOT NULL,
          provider VARCHAR(50) NOT NULL,
          value VARCHAR(100) NOT NULL,
          price VARCHAR(100) NOT NULL,
          name VARCHAR(50) NOT NULL,
          PRIMARY KEY (epoch, amm, bribe_id)
        );`
      );
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS positions (
          amm VARCHAR(50) NOT NULL,
          user_address VARCHAR(50) NOT NULL,
          balance VARCHAR(50) NOT NULL,
          staked_balance VARCHAR(50) NOT NULL,
          derived_balance VARCHAR(50) NOT NULL,
          attach_BigMap VARCHAR(50) NOT NULL,
          PRIMARY KEY (amm, user_address)
        );`
      );
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS v3_positions (
          key_id NUMERIC,
          amm VARCHAR(50) NOT NULL,
          owner VARCHAR(50) NOT NULL,
          upper_tick_index VARCHAR(50) NOT NULL,
          lower_tick_index VARCHAR(50) NOT NULL,
          liquidity VARCHAR(50) NOT NULL,
          fee_growth_inside_last_x VARCHAR(50) NOT NULL,
          fee_growth_inside_last_y VARCHAR(50) NOT NULL,
          PRIMARY KEY (key_id, amm)
        );`
      );
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS total_amm_votes (
          amm VARCHAR(50) NOT NULL,
          epoch VARCHAR(50) NOT NULL,
          value VARCHAR(100) NOT NULL,
          PRIMARY KEY (amm, epoch)
        );`
      );

      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS total_token_votes (
          token_id VARCHAR(50) NOT NULL,
          epoch VARCHAR(50) NOT NULL,
          value VARCHAR(100) NOT NULL,
          PRIMARY KEY (token_id, epoch)
        );`
      );

      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS token_amm_votes (
          amm VARCHAR(50) NOT NULL,
          epoch VARCHAR(50) NOT NULL,
          token_id VARCHAR(50) NOT NULL,
          value VARCHAR(100) NOT NULL,
          fee_claimed BOOLEAN NOT NULL,
          bribes NUMERIC[] NOT NULL,
          bribes_unclaimed NUMERIC[] NOT NULL,
          PRIMARY KEY (amm, epoch, token_id)
        );`
      );

      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS fees (
          amm VARCHAR(50) NOT NULL,
          epoch VARCHAR(50) NOT NULL,
          token1_symbol VARCHAR(50) NOT NULL,
          token1_fee VARCHAR(100) NOT NULL,
          token2_symbol VARCHAR(50) NOT NULL,
          token2_fee VARCHAR(100) NOT NULL,
          PRIMARY KEY (amm, epoch)
        );`
      );
      /*       await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS slopes (
          ts VARCHAR(50) PRIMARY KEY,
          slope VARCHAR(100) NOT NULL
        );`
      ); */
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS epochs (
          epoch VARCHAR(50) PRIMARY KEY,
          epoch_end_ts VARCHAR(50) NOT NULL,
          epoch_total_vp VARCHAR(100) NOT NULL,
          epoch_inflation VARCHAR(100) NOT NULL
        );`
      );
    } catch (err) {
      throw err;
    }
  }

  async get(params: DatabaseGetParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(
        `SELECT ${params.select} FROM ${params.table} WHERE ${params.where} LIMIT 1;`
      );
      return res;
    } catch (err) {
      throw err;
    }
  }

  async getAll(params: DatabaseGetParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`SELECT ${params.select} FROM ${params.table} WHERE ${params.where};`);
      return res;
    } catch (err) {
      throw err;
    }
  }
  async getAllNoQuery(params: DatabaseGetParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`SELECT ${params.select} FROM ${params.table};`);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async insert(params: DatabaseInsertParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`INSERT INTO ${params.table} ${params.columns} VALUES ${params.values};`);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async delete(params: DatabaseDeleteParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`DELETE FROM ${params.table} WHERE ${params.where};`);
      return res;
    } catch (err) {
      throw err;
    }
  }

  async update(params: DatabaseUpdateParams): Promise<QueryResult<any>> {
    try {
      const res = await this._dbClient.query(`UPDATE ${params.table} SET ${params.set} WHERE ${params.where};`);
      return res;
    } catch (err) {
      throw err;
    }
  }
}
