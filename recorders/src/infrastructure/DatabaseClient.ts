import { Client, QueryResult } from "pg";

import { Config, DatabaseDeleteParams, DatabaseGetParams, DatabaseInsertParams, DatabaseUpdateParams } from "../types";

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
          attached BOOLEAN NOT NULL
        );`
      );
      await this._dbClient.query(
        `CREATE TABLE IF NOT EXISTS pools (
          amm VARCHAR(50) PRIMARY KEY,
          type VARCHAR(50) NOT NULL,
          lqt_decimals NUMERIC NOT NULL,
          lqt_symbol VARCHAR(50) NOT NULL,
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
          bribe_BigMap VARCHAR(100) NOT NULL
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
