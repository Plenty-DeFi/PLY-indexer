import BigNumber from "bignumber.js";
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
import { createClient, Client } from "graphql-ws";
import WebSocket, { CloseEvent } from "ws";

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
      const query = gql`
        query BigmapValuesQuery($id: BigNumber!, $limit: Int!, $after: Cursor) {
          bigmap_keys(filter: { bigmap_id: $id }, first: $limit, after: $after) {
            page_info {
              has_next_page
            }
            edges {
              cursor
              node {
                key
                current_value {
                  value
                }
              }
            }
          }
        }
      `;
      const variables: LocksQueryVariable = {
        id: this._contracts.bigMaps.ledger.toString(),
        limit: this._config.tezGraphLimit,
      };
      while (true) {
        const data = await request(this._config.tezGraph, query, variables);
        for (const lock of data.bigmap_keys.edges) {
          if (lock.node.current_value.value === "1") {
            await this._processLock(lock);
          }
          //TODO: write else part when lock is withdrawn, set everything to 0 (ledger=0 and not present in locks bigmap)
        }
        if (!data.bigmap_keys.page_info.has_next_page) {
          break;
        }
        let cursor = data.bigmap_keys.edges[variables.limit - 1].cursor;
        variables.after = cursor;
      }
      /*       this._graphClient.subscribe(
        {
          query: `subscription{
            transactionAdded(
              filter: {
                destination: { equalTo: "KT18fMAVwfCyjoyofnGQ9ij8Z5eW3MwdYWK7" }
              }
            ) {
                parameters{
                  entrypoint
                  value
                }
              }
            }
          `,
        },
        {
          next: (data) => console.log("data:", data),
          error: (error: CloseEvent) => console.log("error as:", error.reason, error.code),
          complete: () => console.log("completed"),
        }
      ); */
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
            console.log(lock);
            if (lock.value !== 0) {
              await this._processLockValue(lock.tokenId, lock.owner);
            }
            //TODO: write else part when lock is withdrawn, set everything to 0 (ledger=0 and not present in locks bigmap)
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
      console.log(values);
      const attached: boolean = await this._getAttached(tokenId);
      console.log(attached);
      const lockData = {
        ...values,
        attached,
        owner,
        tokenId,
      };
      await this._lockDbOperation(lockData);
    } catch (err) {
      throw err;
    }
  }

  private async _processLock(lock: any): Promise<void> {
    try {
      const [owner, tokenId]: string[] = Object.values(lock.node.key);
      console.log(owner, tokenId);
      const values: LockValues = await this._getLockValues(tokenId);
      console.log(values);
      const attached: boolean = await this._getAttached(tokenId);
      console.log(attached);
      const lockData = {
        ...values,
        attached,
        owner,
        tokenId,
      };
      await this._lockDbOperation(lockData);
    } catch (err) {
      throw err;
    }
  }

  private async _getLockValues(tokenId: string): Promise<LockValues> {
    try {
      const query = gql`
        query BigmapValuesQuery($id: BigNumber!, $key: Micheline) {
          bigmap_values(first: 1, filter: { bigmap_id: $id, key: $key }) {
            edges {
              node {
                key
                value
              }
            }
          }
        }
      `;
      const variables = {
        key: tokenId,
        id: this._contracts.bigMaps.locks.toString(),
      };
      const data = await request(this._config.tezGraph, query, variables);
      return data.bigmap_values.edges[0].node.value;
    } catch (err) {
      throw err;
    }
  }
  private async _getAttached(tokenId: string): Promise<boolean> {
    try {
      const query = gql`
        query BigmapValuesQuery($id: BigNumber!, $key: Micheline) {
          bigmap_values(first: 1, filter: { bigmap_id: $id, key: $key }) {
            edges {
              node {
                key
                value_michelson
              }
            }
          }
        }
      `;
      const variables = {
        key: tokenId,
        id: this._contracts.bigMaps.attached.toString(),
      };
      const data = await request(this._config.tezGraph, query, variables);
      if (data.bigmap_values.edges.length === 0) {
        return false;
      } else {
        return data.bigmap_values.edges[0].node.value_michelson === "Unit";
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
        console.log("Inseting Lock ${lockData.tokenId}");
        this._dbClient.insert({
          table: "locks",
          columns: "(id, owner, base_value, end_ts, attached)",
          values: `(${lockData.tokenId}, '${lockData.owner}', '${lockData.base_value}', '${lockData.end}', ${lockData.attached})`,
        });
      } else {
        const existingEntry = await this._dbClient.get({
          select: "*",
          table: "locks",
          where: `id=${lockData.tokenId} AND owner='${lockData.owner}' AND base_value='${lockData.base_value}' AND end_ts='${lockData.end}' AND attached=${lockData.attached}`,
        });
        if (existingEntry.rowCount === 0) {
          console.log("Updating Lock ${lockData.tokenId}");
          this._dbClient.update({
            table: "locks",
            set: `owner='${lockData.owner}', base_value='${lockData.base_value}', end_ts='${lockData.end}', attached=${lockData.attached}`,
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
      // create a array of tokenIds, remove duplicates
      const tokenIds = [...new Set([...ledgerUpdates, ...locksUpdates, ...attachmentsUpdates])];
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
          //update.action === "remove" this means lock withdrawn, handle accordlingly later
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
          //update.action === "remove" this means lock withdrawn, handle accordlingly later
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
