import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";
import { votingPower } from "../../infrastructure/utils";
import TzktProvider from "infrastructure/TzktProvider";
import BigNumber from "bignumber.js";

function build({ dbClient, config, contracts, tzktProvider }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const address = req.query.address as string;
      const token_id = req.query.token_id as string;
      if (!address && !token_id) {
        return res.status(400).json({ message: "MISSING_ADDRESS_OR_ID" });
      }
      let locks;
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
      if (locks.rowCount !== 0) {
        console.log("locks", locks.rows);
        const finalLocksPromise = locks.rows.map(async (lock) => {
          //const contract = await tezos.contract.at(contracts.voteEscrow.address);
          const date = Math.round(new Date().getTime() / 1000);
          const epochtVotingPower = (await votingPower(lock.id, date, 1));
          const currentVotingPower = (await votingPower(lock.id, date, 0));
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const usedVotingPower = await tzktProvider.getTokenVotes(
            contracts.bigMaps.total_token_votes.toString(),
            currentEpoch,
            lock.id
          );
          console.log("epcoh", epochtVotingPower);
          console.log("used", usedVotingPower);
          return {
            id: lock.id,
            owner: lock.owner,
            baseValue: lock.base_value,
            endTs: lock.end_ts,
            attached: lock.attached,
            epochtVotingPower,
            currentVotingPower,
            availableVotingPower: new BigNumber(epochtVotingPower).minus(new BigNumber(usedVotingPower)).toFixed(),
          };
        });
        finalLocks = await Promise.all(finalLocksPromise);
        console.log("finalLocks", finalLocks);
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
