import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";
import { votingPower } from "../../infrastructure/utils";
import TzktProvider from "../../infrastructure/TzktProvider";
import BigNumber from "bignumber.js";
import { QueryResult } from "pg";

function build({ dbClient, config, contracts, tzktProvider }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const address = req.query.address as string;
      const token_id = req.query.token_id as string;
      const epoch = req.query.epoch as string;
      const timestamp = req.query.timestamp as string;
      if (!address && !token_id) {
        return res.status(400).json({ message: "MISSING_ADDRESS_OR_ID" });
      }
      let locks: QueryResult<any>;
      if (address && !token_id) {
        locks = await dbClient.getAll({
          select: "*",
          table: "locks",
          where: `owner='${address}'`,
        });
      } else if (!address && token_id) {
        //todo get unclaimed epoch and total value unclaimed
        locks = await dbClient.get({
          select: "*",
          table: "locks",
          where: `id=${token_id}`,
        });
      } else {
        locks = await dbClient.get({
          select: "*",
          table: "locks",
          where: `owner='${address}' AND id=${token_id}`,
        });
      }
      let finalLocks: Lock[] = [];
      const asyncFilter = async (arr: any[], predicate: any) => {
        const results = await Promise.all(arr.map(predicate));

        return arr.filter((_v, index) => results[index]);
      };
      async function filterLocks() {
        if (epoch && timestamp) {
          const locksAll = await asyncFilter(locks.rows, async (data: any) => {
            const TzktObj = new TzktProvider(config);
            const all_token_checkpoints = await TzktObj.getAllTokenCheckpoints(
              parseInt(data.id),
              contracts.bigMaps.all_tokens_checkpoint
            );
            const map1 = new Map();
            //console.log(all_token_checkpoints);
            for (var x in all_token_checkpoints) {
              map1.set(all_token_checkpoints[x].key.nat_1, all_token_checkpoints[x].value);
            }
            //console.log(map1.get("1"));
            //console.log(parseInt(timestamp) < parseInt(map1.get("1").ts));

            if (parseInt(timestamp) < parseInt(map1.get("1").ts)) {
              //console.log("false");
              return false;
            } else {
              return true;
            }
          });
          return locksAll;
        } else {
          return locks.rows;
        }
      }
      if (locks.rowCount !== 0) {
        //console.log("locks", locks.rows);
        const locksAll = await filterLocks();
        //console.log(locksAll);
        const finalLocksPromise = locksAll.map(async (lock) => {
          //const contract = await tezos.contract.at(contracts.voteEscrow.address);
          const date = timestamp ? parseInt(timestamp) : Math.round(new Date().getTime() / 1000);
          const next_date = date + 7 * 86400; //todo change later to 7*86400;
          const epochtVotingPower = await votingPower(lock.id, date, 1, contracts.bigMaps.all_tokens_checkpoint, contracts.bigMaps.num_tokens_checkpoint);
          const nextVotingPower = await votingPower(lock.id, next_date, 1, contracts.bigMaps.all_tokens_checkpoint, contracts.bigMaps.num_tokens_checkpoint);
          const currentVotingPower = await votingPower(lock.id, date, 0, contracts.bigMaps.all_tokens_checkpoint, contracts.bigMaps.num_tokens_checkpoint);
          const currentEpoch = epoch ? epoch : await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const usedVotingPower = await tzktProvider.getTokenVotes(
            contracts.bigMaps.total_token_votes.toString(),
            currentEpoch,
            lock.id
          );
          //console.log("epcoh", epochtVotingPower);
          //console.log("used", usedVotingPower);
          return {
            id: lock.id,
            owner: lock.owner,
            baseValue: lock.base_value,
            endTs: lock.end_ts,
            attached: lock.attached,
            epochtVotingPower,
            currentVotingPower,
            availableVotingPower: new BigNumber(epochtVotingPower).minus(new BigNumber(usedVotingPower)).toFixed(),
            nextEpochVotingPower: nextVotingPower,
          };
        });
        finalLocks = await Promise.all(finalLocksPromise);
        //console.log("finalLocks", finalLocks);
      }

      return res.json({ result: finalLocks });
    } catch (e) {
      console.log(e);

      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
