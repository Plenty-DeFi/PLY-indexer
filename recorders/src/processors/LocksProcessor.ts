import DatabaseClient from "../infrastructure/DatabaseClient";
import TzktProvider from "../infrastructure/TzktProvider";
import {
  Config,
  Dependecies,
  Contracts,
  Transaction,
  LocksQueryVariable,
  LockValues,
  Lock,
  BigMapUpdateResponseType,
} from "../types";
import { request, gql } from "graphql-request";
import { Client } from "graphql-ws";

export default class LocksProcessor {
  private _config: Config;
  private _dbClient: DatabaseClient;
  private _tkztProvider: TzktProvider;
  private _contracts: Contracts;
  private _graphClient: Client;
  constructor({ config, dbClient, tzktProvider, contracts }: Dependecies) {
    this._config = config;
    this._dbClient = dbClient;
    this._tkztProvider = tzktProvider;
    this._contracts = contracts;
    //this._graphClient = createClient({ url: config.tezGraphWs });
  }

  async process(): Promise<void> {
    try {
      let offset = 0;
      while (true) {
        const locks: {
          key: { nat: string; address: string };
          value: string;
        }[] = await this._tkztProvider.getLocks({
          bigMap: this._contracts.bigMaps.ledger.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (locks.length === 0) {
          break;
        } else {
          for (const lock of locks) {
            if (lock.value === "1") {
              await this._processLock(lock);
            } else {
              const existingEntry = await this._dbClient.get({
                select: "*",
                table: "locks",
                where: `id=${lock.key.nat} AND owner='${lock.key.address}'`,
              });
              if (existingEntry.rowCount > 0) {
                await this._dbClient.delete({
                  table: "locks",
                  where: `id=${lock.key.nat}`,
                });
              }
            }
          }
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.error("error a:", err);
    }
  }

  async processSpecificLocks(tokenIds: string[]): Promise<void> {
    try {
      let locks: { owner: string; tokenId: string; value: number }[] = [];
      let offset = 0;
      while (true) {
        const data = await this._tkztProvider.getLedgerData<{ key: { nat: string; address: string }; value: string }[]>(
          {
            bigMap: this._contracts.bigMaps.ledger.toString(),
            offset,
            limit: this._config.tzktLimit,
            tokenIds,
          }
        );
        if (data.length === 0) {
          for (const lock of locks) {
            //console.log(lock);
            if (lock.value !== 0) {
              await this._processLockValue(lock.tokenId, lock.owner);
            } else {
              const existingEntry = await this._dbClient.get({
                select: "*",
                table: "locks",
                where: `id=${lock.tokenId} AND owner='${lock.owner}'`,
              });
              if (existingEntry.rowCount > 0) {
                await this._dbClient.delete({
                  table: "locks",
                  where: `id=${lock.tokenId}`,
                });
              }
            }
          }
          break;
        } else {
          locks = locks.concat(
            data.map((lock) => {
              return { owner: lock.key.address, tokenId: lock.key.nat, value: parseInt(lock.value) };
            })
          );
          offset += this._config.tzktOffset;
        }
      }
    } catch (err) {
      console.log(err);
      throw err;
    }
  }

  private async _processLockValue(tokenId: string, owner: string): Promise<void> {
    try {
      console.log(owner, tokenId);
      const values: LockValues = await this._getLockValues(tokenId);
      //console.log(values);
      const attached: boolean = await this._getAttached(tokenId);
      //console.log(attached);
      const epoch = await this._getEpoch(tokenId);
      const claimedEpochs: string[] = [];
      let offset = 0;
      while (true) {
        const claimed = await this._tkztProvider.getClaimedEpochs({
          bigMap: this._contracts.bigMaps.claim_ledger.toString(),
          token_id: tokenId,
          limit: this._config.tzktLimit,
          offset,
        });
        if (claimed.length === 0) {
          break;
        } else {
          claimedEpochs.push(...claimed);
          offset += this._config.tzktOffset;
        }
      }

      const claimedEpochsSql = claimedEpochs.length != 0 ? `{${claimedEpochs.map((b) => b).join(",")}}` : "{}";
      const lockData = {
        ...values,
        attached,
        owner,
        tokenId,
        epoch,
        claimedEpochs: claimedEpochsSql,
      };
      await this._lockDbOperation(lockData);
    } catch (err) {
      throw err;
    }
  }

  private async _processLock(lock: { key: { nat: string; address: string }; value: string }): Promise<void> {
    try {
      const owner = lock.key.address;
      const tokenId = lock.key.nat;
      console.log(owner, tokenId);
      const values: LockValues = await this._getLockValues(tokenId);
      //console.log(values);
      const attached: boolean = await this._getAttached(tokenId);
      //console.log(attached);
      const epoch = await this._getEpoch(tokenId);
      const claimedEpochs: string[] = [];
      let offset = 0;
      while (true) {
        const claimed = await this._tkztProvider.getClaimedEpochs({
          bigMap: this._contracts.bigMaps.claim_ledger.toString(),
          token_id: tokenId,
          limit: this._config.tzktLimit,
          offset,
        });
        if (claimed.length === 0) {
          break;
        } else {
          claimedEpochs.push(...claimed);
          offset += this._config.tzktOffset;
        }
      }
      const claimedEpochsSql = claimedEpochs.length != 0 ? `{${claimedEpochs.map((b) => b).join(",")}}` : "{}";
      const lockData = {
        ...values,
        attached,
        owner,
        tokenId,
        epoch,
        claimedEpochs: claimedEpochsSql,
      };
      await this._lockDbOperation(lockData);
    } catch (err) {
      throw err;
    }
  }

  private async _getEpoch(tokenId: string): Promise<string> {
    try {
      const ts = await this._tkztProvider.getLockTs({
        bigMap: this._contracts.bigMaps.token_checkpoints.toString(),
        token_id: tokenId,
      });
      const timeISO = new Date(parseInt(ts) * 1000).toISOString();
      const block = await this._tkztProvider.getBlock({ ts: timeISO });
      const epoch = await this._tkztProvider.getEpochfromLevel(this._contracts.voter.address, block);
      return epoch;
    } catch (err) {
      throw err;
    }
  }

  private async _getLockValues(tokenId: string): Promise<LockValues> {
    try {
      const values: {
        key: string;
        value: {
          base_value: string;
          end: string;
        };
      } = await this._tkztProvider.getLockValues({
        bigmap: this._contracts.bigMaps.locks.toString(),
        tokenId: tokenId,
      });

      return { base_value: values.value.base_value, end: values.value.end };
    } catch (err) {
      throw err;
    }
  }
  private async _getAttached(tokenId: string): Promise<boolean> {
    try {
      const data: {
        key: string;
        value: {
          base_value: string;
          end: string;
        };
        active: boolean;
      }[] = await this._tkztProvider.getLockAttached({
        bigmap: this._contracts.bigMaps.attached.toString(),
        tokenId: tokenId,
      });

      if (data.length === 0) {
        return false;
      } else {
        return data[0].active;
      }
    } catch (err) {
      throw err;
    }
  }

  private async _lockDbOperation(lockData: Lock): Promise<void> {
    try {
      const existingLock = await this._dbClient.get({
        select: "*",
        table: "locks",
        where: `id = '${lockData.tokenId}'`,
      });
      if (existingLock.rowCount === 0) {
        console.log(`Inseting Lock ${lockData.tokenId}`);
        await this._dbClient.insert({
          table: "locks",
          columns: "(id, owner, base_value, end_ts, attached, epoch, claimed_epochs)",
          values: `(${lockData.tokenId}, '${lockData.owner}', '${lockData.base_value}', '${lockData.end}', ${lockData.attached}, '${lockData.epoch}', '${lockData.claimedEpochs}')`,
        });
      } else {
        const existingEntry = await this._dbClient.get({
          select: "*",
          table: "locks",
          where: `id=${lockData.tokenId} AND owner='${lockData.owner}' AND base_value='${lockData.base_value}' AND end_ts='${lockData.end}' AND attached=${lockData.attached} AND claimed_epochs='${lockData.claimedEpochs}'`,
        });
        if (existingEntry.rowCount === 0) {
          console.log(`Updating Lock ${lockData.tokenId}`);
          await this._dbClient.update({
            table: "locks",
            set: `owner='${lockData.owner}', base_value='${lockData.base_value}', end_ts='${lockData.end}', attached=${lockData.attached}, claimed_epochs='${lockData.claimedEpochs}'`,
            where: `id=${lockData.tokenId}`,
          });
        } else {
          console.log("Lock already exists");
        }
      }
    } catch (err) {
      throw err;
    }
  }

  async updateLocks(blockLevel: string): Promise<void> {
    try {
      // Check Ledger
      const ledgerUpdates = await this.getLedgerUpdates(blockLevel);
      // Check locks
      const locksUpdates = await this.getLockUpdates(blockLevel);
      // Check attachments
      const attachmentsUpdates = await this.getAttachmentUpdates(blockLevel);
      // Check claimed epochs updates
      const claimedEpochsUpdates = await this.getClaimInflationUpdates(blockLevel);
      // create a array of tokenIds, remove duplicates
      const tokenIds = [
        ...new Set([...ledgerUpdates, ...locksUpdates, ...attachmentsUpdates, ...claimedEpochsUpdates]),
      ];
      // call processSepecificLocks with array of tokenIds
      console.log("updating tokenIds:", tokenIds);
      if (tokenIds.length > 0) {
        await this.processSpecificLocks(tokenIds);
      }
    } catch (e) {
      console.log(e);
    }
  }

  //transfer, withdraw
  async getLedgerUpdates(level: string): Promise<string[]> {
    try {
      let tokenIdUpdates: string[] = [];
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.ledger.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          tokenIdUpdates = tokenIdUpdates.concat(updates.map((update) => update.content.key.nat.toString()));
          offset += this._config.tzktOffset;
        }
      }
      return tokenIdUpdates;
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  }

  //increase base value, increase endTime, withdraw lock
  async getLockUpdates(level: string): Promise<string[]> {
    try {
      let tokenIdUpdates: string[] = [];
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.locks.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          tokenIdUpdates = tokenIdUpdates.concat(updates.map((update) => update.content.key.toString()));
          offset += this._config.tzktOffset;
        }
      }
      return tokenIdUpdates;
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  }

  //attach, deattach
  async getAttachmentUpdates(level: string): Promise<string[]> {
    try {
      let tokenIdUpdates: string[] = [];
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.attached.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          tokenIdUpdates = tokenIdUpdates.concat(updates.map((update) => update.content.key.toString()));
          offset += this._config.tzktOffset;
        }
      }
      return tokenIdUpdates;
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  }
  //claim infaltion
  async getClaimInflationUpdates(level: string): Promise<string[]> {
    try {
      let tokenIdUpdates: string[] = [];
      let offset = 0;
      while (true) {
        const updates = await this._tkztProvider.getBigMapUpdates<BigMapUpdateResponseType[]>({
          level,
          bigmapId: this._contracts.bigMaps.claim_ledger.toString(),
          limit: this._config.tzktLimit,
          offset,
        });
        if (updates.length === 0) {
          break;
        } else {
          tokenIdUpdates = tokenIdUpdates.concat(updates.map((update) => update.content.key.token_id.toString()));
          offset += this._config.tzktOffset;
        }
      }
      return tokenIdUpdates;
    } catch (err) {
      console.error("error b:", err);
      throw err;
    }
  }
}

//   async process(): Promise<void> {
//     try {
//       for (const amm of Object.keys(this._contracts.amm)) {
//         const operationHashes = await this._getSwapOperationHashes(amm);
//         for (const hash of operationHashes) {
//           const operation = await this._tkztProvider.getOperation(hash);
//           this._processSwapOperation(operation);
//         }
//       }
//     } catch (err) {
//       console.error(err);
//     }
//   }

//   private async _processSwapOperation(operation: Transaction[]): Promise<void> {
//     try {
//       // Get all swaps from the operation
//       const swapIndices: number[] = [];
//       for (const [index, txn] of operation.entries()) {
//         if (txn.parameter && this._contracts.amm[txn.target?.address]) {
//           if (
//             ["Swap", "ctez_to_tez", "tez_to_ctez"].includes(
//               txn.parameter?.entrypoint
//             )
//           ) {
//             swapIndices.push(index);
//           }
//         }
//       }

//       const id = operation[swapIndices[0]].id;
//       const opHash = operation[0].hash;
//       const existingEntry = await this._dbClient.get({
//         table: "swap",
//         select: "op_hash",
//         where: `op_hash='${opHash}' AND id=${id}`,
//       });

//       // Return if already indexed
//       if (existingEntry.rowCount !== 0) return;

//       for (const swapIndex of swapIndices) {
//         const txn = operation[swapIndex];

//         // Get input token
//         const [inputToken, inputAmount] = this._getInput(operation, swapIndex);

//         // Get output token (second transfer after last swap)
//         const [_, outputAmount] = this._getOutput(operation, swapIndex);

//         const token1 =
//           this._contracts.amm[txn.target.address].token1 === inputToken
//             ? -inputAmount
//             : outputAmount;
//         const token2 =
//           this._contracts.amm[txn.target.address].token2 === inputToken
//             ? -inputAmount
//             : outputAmount;

//         // Insert swap into postgres db
//         this._dbClient.insert({
//           table: "swap",
//           columns: "(id, op_hash, ts, account, amm, token_1, token_2)",
//           values: `(${txn.id}, '${txn.hash}', ${Math.floor(
//             new Date(txn.timestamp).getTime() / 1000
//           )}, '${
//             operation[swapIndex].initiator
//               ? operation[swapIndex].initiator.address
//               : operation[swapIndex].sender.address
//           }', '${txn.target.address}', ${token1}, ${token2})`,
//         });

//         // Timestamp at start of day (UTC)
//         const roundedTS =
//           Math.floor(new Date(txn.timestamp).getTime() / 86400000) * 86400;

//         const existingEntry = await this._dbClient.get({
//           select: "*",
//           table: "amm_aggregate",
//           where: `ts=${roundedTS} AND amm='${txn.target.address}'`,
//         });

//         // TODO: Fetch real price from price servive
//         const price = 1.96;

//         let volume = this._calculateValueUSD(inputToken, inputAmount, price);
//         let fee = this._calculateFeeUSD(inputToken, inputAmount, price);
//         let tvl = 0;

//         if (existingEntry.rowCount === 0) {
//           this._dbClient.insert({
//             table: "amm_aggregate",
//             columns: `(ts, amm, volume_usd, fee_usd, tvl_usd)`,
//             values: `(${roundedTS}, '${txn.target.address}', ${volume}, ${fee}, ${tvl})`, // TODO: calculate tvl
//           });
//         } else {
//           volume += parseFloat(existingEntry.rows[0].volume_usd);
//           fee += parseFloat(existingEntry.rows[0].fee_usd);

//           this._dbClient.update({
//             table: "amm_aggregate",
//             set: `volume_usd=${volume}, fee_usd=${fee}, tvl_usd=${tvl}`,
//             where: `ts=${roundedTS} AND amm='${txn.target.address}'`,
//           });
//         }
//       }
//     } catch (err) {
//       throw err;
//     }
//   }

//   /**
//    * @description Works based on the fact that the first token transferred during a non tez swap is
//    * the input token. Whereas, for tez input, the amount is transferred directly to the entrypoint.
//    */
//   private _getInput(
//     operation: Transaction[],
//     swapIndex: number
//   ): [string, string] {
//     const swapTxn = operation[swapIndex];
//     if (swapTxn.parameter.entrypoint === "Swap") {
//       const tokenTxn = operation[swapIndex + 1];
//       if (Array.isArray(tokenTxn.parameter.value)) {
//         // FA2 token
//         const amount = tokenTxn.parameter.value[0].txs[0].amount;
//         const tokenId = tokenTxn.parameter.value[0].txs[0].token_id;
//         return [`${tokenTxn.target.address}_${tokenId}`, amount];
//       } else {
//         // FA1.2 token
//         const amount = tokenTxn.parameter.value.value;
//         return [`${tokenTxn.target.address}_0`, amount];
//       }
//     } else if (swapTxn.parameter.entrypoint === "ctez_to_tez") {
//       // ctez input
//       const tokenTxn = operation[swapIndex + 3];
//       const amount = tokenTxn.parameter.value.value;
//       return ["ctez", amount];
//     } else {
//       // tez input
//       const amount = swapTxn.amount.toString();
//       return ["tez", amount];
//     }
//   }

//   /**
//    * @description Works on similar grounds as _getInput
//    */
//   private _getOutput(
//     operation: Transaction[],
//     swapIndex: number
//   ): [string, string] {
//     const swapTxn = operation[swapIndex];
//     if (swapTxn.parameter.entrypoint === "Swap") {
//       const tokenTxn = operation[swapIndex + 2];
//       if (Array.isArray(tokenTxn.parameter.value)) {
//         // FA2 token
//         const amount = tokenTxn.parameter.value[0].txs[0].amount;
//         const tokenId = tokenTxn.parameter.value[0].txs[0].token_id;
//         return [`${tokenTxn.target.address}_${tokenId}`, amount];
//       } else {
//         // FA1.2 token
//         const amount = tokenTxn.parameter.value.value;
//         return [`${tokenTxn.target.address}_0`, amount];
//       }
//     } else if (swapTxn.parameter.entrypoint === "tez_to_ctez") {
//       // ctez output
//       const tokenTxn = operation[swapIndex + 3];
//       const amount = tokenTxn.parameter.value.value;
//       return ["ctez", amount];
//     } else {
//       // tez output
//       const tokenTxn = operation[swapIndex + 3];
//       const amount = tokenTxn.amount.toString();
//       return ["tez", amount];
//     }
//   }

//   private async _getSwapOperationHashes(contract: string): Promise<string[]> {
//     try {
//       const [firstLevel, lastLevel] = await this._getIndexingLevels(contract);
//       let offset = 0;
//       let operationHashes: string[] = [];
//       while (true) {
//         const hashes = await this._tkztProvider.getTransactions<string[]>({
//           contract,
//           entrypoint:
//             contract === "KT1CAYNQGvYSF5UvHK21grMrKpe2563w9UcX"
//               ? ["tez_to_ctez", "ctez_to_tez"]
//               : ["Swap"],
//           firstLevel,
//           lastLevel,
//           limit: this._config.tzktLimit,
//           offset,
//           select: "hash",
//         });
//         if (hashes.length === 0) {
//           break;
//         } else {
//           operationHashes = operationHashes.concat(hashes);
//           offset += this._config.tzktOffset;
//         }
//       }
//       return operationHashes;
//     } catch (err) {
//       throw err;
//     }
//   }

//   // Todo: Fetch from a shared json
//   private async _getIndexingLevels(
//     contract: string
//   ): Promise<[number, number]> {
//     return [2361000, 2384000]; // [last level from json, current level from json]
//   }

//   private _calculateValueUSD(
//     token: string,
//     amount: string,
//     unitPrice: number
//   ): number {
//     return new BigNumber(amount)
//       .multipliedBy(unitPrice)
//       .dividedBy(10 ** this._contracts.tokens[token].decimals)
//       .toNumber();
//   }

//   private _calculateFeeUSD(
//     token: string,
//     amount: string,
//     unitPrice: number
//   ): number {
//     if (token === "tez" || token === "ctez") {
//       return new BigNumber(this._calculateValueUSD(token, amount, unitPrice))
//         .multipliedBy(0.001)
//         .toNumber();
//     } else {
//       return new BigNumber(this._calculateValueUSD(token, amount, unitPrice))
//         .multipliedBy(0.0035)
//         .toNumber();
//     }
//   }
// }
