//first detect epoch change form epoch_end bigmap
//second get all epoch votes that just ended from total_epoch_votes bigmap store in db per epoch and votes amm vise for the epoch
//third get all token votes amm vise for the epoch that just ended (where we know epoch) ,extra params: fee_claimed, bribe_id[], bribe_id_unclaimed[]
// listen to claim ledger in fee_distributor and gauge and handle votes accordingly

//get fee from fee_distributor's amm_epoch_fee bigmap

//fetching --> get lock ids from address --> get all votes where fee_claimed flase AND bribe_id_unclaimed length =0, get bribes, get total amm votes for each epch and calculate vote share

import { asyncFilter } from "../infrastructure/utils";
import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import {
  Config,
  Dependecies,
  Contracts,
  BigMapUpdateResponseType,
  TotalAmmVotes,
  TokenAmmVotes,
  Pool,
  TotalTokenVotes,
} from "../types";
import EpochsProcessor from "./EpochsProcessor";

export default class VotesProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  private _contracts: Contracts;
  private _epochProcessor: EpochsProcessor;

  constructor({ config, dbClient, tzktProvider, contracts }: Dependecies) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
    this._contracts = contracts;
    this._epochProcessor = new EpochsProcessor({ config, dbClient, tzktProvider, contracts });
  }

  async process() {
    try {
      console.log("Votes processing started");

      await this.processTotalAmmVotes();
      await this.processTokenAmmVotes();
      await this.processTotalTokenVotes();
    } catch (e) {
      console.log("Error from votes processing", e);
    }
  }

  async processTotalAmmVotes() {
    try {
      let offset = 0;
      while (true) {
        const total_amm_votes: TotalAmmVotes[] = await this._tkztProvider.getBigMap({
          bigMap: this._contracts.bigMaps.total_amm_votes.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (total_amm_votes.length === 0) {
          break;
        } else {
          for (const votes of total_amm_votes) {
            await this._dbClient.insert({
              table: "total_amm_votes",
              columns: "(amm, epoch, value)",
              values: `('${votes.key.amm}', '${votes.key.epoch}', '${votes.value}')`,
            });
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error processing total amm votes", e);
      throw e;
    }
  }

  async processTotalTokenVotes() {
    try {
      let offset = 0;
      while (true) {
        const total_token_votes: TotalTokenVotes[] = await this._tkztProvider.getBigMap({
          bigMap: this._contracts.bigMaps.total_token_votes.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (total_token_votes.length === 0) {
          break;
        } else {
          for (const votes of total_token_votes) {
            console.log("Inserting total token votes", votes.key.token_id, votes.key.epoch, votes.value);
            await this._dbClient.insert({
              table: "total_token_votes",
              columns: "(token_id, epoch, value)",
              values: `('${votes.key.token_id}', '${votes.key.epoch}', '${votes.value}')`,
            });
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error processing total token votes", e);
      throw e;
    }
  }

  async processTokenAmmVotes() {
    try {
      let offset = 0;
      while (true) {
        const total_amm_votes: TokenAmmVotes[] = await this._tkztProvider.getBigMap({
          bigMap: this._contracts.bigMaps.token_amm_votes.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (total_amm_votes.length === 0) {
          break;
        } else {
          for (const votes of total_amm_votes) {
            const bribes = await this._dbClient.getAll({
              select: "*",
              table: "bribes",
              where: `amm='${votes.key.amm}' AND epoch='${votes.key.epoch}'`,
            });

            const finalBribes = await asyncFilter(bribes.rows, async (b: any) => {
              const claimed = await this.checkBribeClaimed(votes.key.amm, votes.key.token_id, b.bribe_id);
              return !claimed;
            });

            //array to postgress array
            const unclaimedBribeArray =
              finalBribes.length != 0 ? `{${finalBribes.map((b) => b.bribe_id).join(",")}}` : "{}";
            const bribesArray = bribes.rowCount != 0 ? `{${bribes.rows.map((b) => b.bribe_id).join(",")}}` : "{}";

            const feeClaimed = await this.checkFeeClaimed(votes.key.amm, votes.key.epoch, votes.key.token_id);

            const existingEntry = await this._dbClient.get({
              select: "*",
              table: "token_amm_votes",
              where: `amm='${votes.key.amm}' AND epoch='${votes.key.epoch}' AND token_id='${votes.key.token_id}'`,
            });
            if (existingEntry.rowCount === 0) {
              console.log("Inseting Token AMM vote" + votes.key.amm + " " + votes.key.epoch + " " + votes.key.token_id);
              await this._dbClient.insert({
                table: "token_amm_votes",
                columns: "(amm, epoch, token_id, value, fee_claimed, bribes, bribes_unclaimed)",
                values: `('${votes.key.amm}', '${votes.key.epoch}', '${votes.key.token_id}', '${votes.value}', ${feeClaimed}, '${bribesArray}', '${unclaimedBribeArray}')`,
              });
            } else {
              console.log("Updating Token AMM vote" + votes.key.amm + " " + votes.key.epoch + " " + votes.key.token_id);
              await this._dbClient.update({
                table: "token_amm_votes",
                set: `value='${votes.value}', fee_claimed-${feeClaimed}, bribes='${bribesArray}', bribes_unclaimed='${unclaimedBribeArray}'`,
                where: `amm='${votes.key.amm}' AND epoch='${votes.key.epoch}' AND token_id='${votes.key.token_id}'`,
              });
            }
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error processing token amm votes:", err);
      throw err;
    }
  }

  async epochUpdates(level: string) {
    try {
      const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
        level,
        bigmapId: this._contracts.bigMaps.epoch_end.toString(),
        limit: 1,
        offset: 0,
      });
      if (updates.length !== 0) {
        const epoch = (parseInt(updates[0].content.key) - 1).toString();
        const epochEndTs = (Date.parse(updates[0].content.value) / 1000).toFixed(0);
        console.log("Processing epoch", epoch);
        await this.processEpochAmmVotes(epoch);
        await this.processEpochTokenAmmVotes(epoch);
        await this.processEpochTokenTotalVotes(epoch);
        await this._epochProcessor._processEpoch(epoch, epochEndTs);
      }
    } catch (err) {
      console.error("error processing epoch:", err);
      throw err;
    }
  }

  async votesUpdates(level: string) {
    try {
      await this.bribesUpdates(level);
      await this.feesUpdates(level);
    } catch (err) {
      console.error("error votes update:", err);
      throw err;
    }
  }

  async checkFeeClaimed(amm: string, epoch: string, tokenId: string): Promise<boolean> {
    const feeClaimed = await this._tkztProvider.getFeeClaimed({
      bigMap: this._contracts.bigMaps.fee_claim_ledger.toString(),
      amm: amm,
      epoch: epoch,
      token_id: tokenId,
    });
    return feeClaimed.length !== 0;
  }

  async checkBribeClaimed(amm: string, tokenId: string, bribeId: string): Promise<boolean> {
    const pool = (
      await this._dbClient.get({
        select: "*",
        table: "pools",
        where: `amm='${amm}'`,
      })
    ).rows[0];

    const bribeClaimed = await this._tkztProvider.getBribeClaimed({
      bigMap: pool.bribe_claim_ledger.toString(),
      token_id: tokenId,
      bribe_id: bribeId,
    });
    return bribeClaimed.length !== 0;
  }
  async feesUpdates(level: string) {
    try {
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.fee_claim_ledger.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          for (const update of updates) {
            if (update.action === "add_key") {
              console.log(
                "Fees claimed",
                update.content.key.token_id,
                update.content.key.amm,
                update.content.key.epoch
              );
              await this._dbClient.update({
                table: "token_amm_votes",
                set: `fee_claimed=${true}`,
                where: `token_id='${update.content.key.token_id}' AND amm='${update.content.key.amm}' AND epoch='${update.content.key.epoch}'`,
              });
            }
          }

          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error updating fee claimed votes", err);
      throw err;
    }
  }

  async bribesUpdates(level: string) {
    try {
      const pools: Pool[] = (
        await this._dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        })
      ).rows;
      //const tokens = await getTokens(this._config);
      pools.forEach(async (pool) => {
        let offset = 0;
        while (true) {
          const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
            level,
            bigmapId: pool.bribe_claim_ledger.toString(),
            limit: this._config.tzktLimit,
            offset,
          });
          if (updates.length === 0) {
            break;
          } else {
            for (const update of updates) {
              if (update.action === "add_key") {
                console.log("Briged claimed", update.content.key.token_id, update.content.key.bribe_id);
                await this._dbClient.update({
                  table: "token_amm_votes",
                  set: `bribes_unclaimed = array_remove(bribes_unclaimed, ${update.content.key.bribe_id})`,
                  where: `token_id='${update.content.key.token_id}' AND '${update.content.key.bribe_id}'=ANY(bribes_unclaimed)`,
                });
              }
            }

            offset += this._config.tzktOffset;
          }
        }
      });
    } catch (err) {
      console.log("error bribes update votes:", err);
      throw err;
    }
  }

  async processEpochAmmVotes(epoch: string) {
    try {
      let offset = 0;
      while (true) {
        const total_amm_votes: TotalAmmVotes[] = await this._tkztProvider.getEpochTotalAmmVotes({
          bigMap: this._contracts.bigMaps.total_amm_votes.toString(),
          limit: this._config.tzktLimit,
          offset,
          epoch: epoch,
        });
        if (total_amm_votes.length === 0) {
          break;
        } else {
          total_amm_votes.forEach(async (votes) => {
            await this._dbClient.insert({
              table: "total_amm_votes",
              columns: "(amm, epoch, value)",
              values: `('${votes.key.amm}', '${votes.key.epoch}', '${votes.value}')`,
            });
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (e) {
      console.log("Error from processEpochAmmVotes", e);
      throw e;
    }
  }

  async processEpochTokenAmmVotes(epoch: string) {
    try {
      let offset = 0;
      while (true) {
        const total_amm_votes: TokenAmmVotes[] = await this._tkztProvider.getEpochTotalAmmVotes({
          bigMap: this._contracts.bigMaps.token_amm_votes.toString(),
          limit: this._config.tzktLimit,
          offset,
          epoch: epoch,
        });
        if (total_amm_votes.length === 0) {
          break;
        } else {
          total_amm_votes.forEach(async (votes) => {
            const bribes = await this._dbClient.getAll({
              select: "*",
              table: "bribes",
              where: `amm='${votes.key.amm}' AND epoch='${votes.key.epoch}'`,
            });
            //array to postgress array
            const bribesArray = bribes.rowCount != 0 ? `{${bribes.rows.map((b) => b.bribe_id).join(",")}}` : "{}";
            const existingEntry = await this._dbClient.get({
              select: "*",
              table: "token_amm_votes",
              where: `amm='${votes.key.amm}' AND epoch='${votes.key.epoch}' AND token_id='${votes.key.token_id}'`,
            });
            if (existingEntry.rowCount === 0) {
              console.log("Inseting Token AMM vote" + votes.key.amm + " " + votes.key.epoch + " " + votes.key.token_id);
              await this._dbClient.insert({
                table: "token_amm_votes",
                columns: "(amm, epoch, token_id, value, fee_claimed, bribes, bribes_unclaimed)",
                values: `('${votes.key.amm}', '${votes.key.epoch}', '${votes.key.token_id}', '${
                  votes.value
                }', ${false}, '${bribesArray}', '${bribesArray}')`,
              });
            } else {
              console.log("Updating Token AMM vote" + votes.key.amm + " " + votes.key.epoch + " " + votes.key.token_id);
              await this._dbClient.update({
                table: "token_amm_votes",
                set: `value='${
                  votes.value
                }', fee_claimed-${false}, bribes='${bribesArray}', bribes_unclaimed='${bribesArray}'`,
                where: `amm='${votes.key.amm}' AND epoch='${votes.key.epoch}' AND token_id='${votes.key.token_id}'`,
              });
            }
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error processing epoch token amm votes:", err);
      throw err;
    }
  }

  async processEpochTokenTotalVotes(epoch: string) {
    try {
      let offset = 0;
      while (true) {
        const total_token_votes: TotalTokenVotes[] = await this._tkztProvider.getEpochTotalAmmVotes({
          bigMap: this._contracts.bigMaps.total_token_votes.toString(),
          limit: this._config.tzktLimit,
          offset,
          epoch: epoch,
        });
        if (total_token_votes.length === 0) {
          break;
        } else {
          total_token_votes.forEach(async (votes) => {
            await this._dbClient.insert({
              table: "total_token_votes",
              columns: "(token_id, epoch, value)",
              values: `('${votes.key.token_id}', '${votes.key.epoch}', '${votes.value}')`,
            });
          });
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error processing epoch token total votes:", err);
      throw err;
    }
  }
}
