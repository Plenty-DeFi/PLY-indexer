import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";
import { range, votingPower, votingPowerFast } from "../../infrastructure/utils";
import BigNumber from "bignumber.js";
import { TezosToolkit } from "@taquito/taquito";

function build({ dbClient, tzktProvider, contracts }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const address = req.query.address as string;

      if (!address) {
        return res.status(400).json({ message: "MISSING_ADDRESS" });
      }

      const locks = await dbClient.getAll({
        select: "*",
        table: "locks",
        where: `owner='${address}'`,
      });

      if (locks.rowCount !== 0) {
        //console.log(locksAll);
        const response = locks.rows.map(async (lock) => {
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const validArr: string[] = range(parseInt(lock.epoch), parseInt(currentEpoch));
          const unclaimedEpochs = validArr.filter((el) => !lock.claimed_epochs.includes(el));
          const alltokenCheckpoints = await tzktProvider.getAllTokenCheckpoints(lock.id);
          const map1 = new Map();
          for (var x in alltokenCheckpoints) {
            map1.set(alltokenCheckpoints[x].key.nat_1, alltokenCheckpoints[x].value);
          }
          const sec = await tzktProvider.getNumTokenCheckpoints(lock.id);
          const result = unclaimedEpochs.map(async (epoch) => {
            const epochData = await dbClient.get({
              select: "*",
              table: "epochs",
              where: `epoch='${epoch}'`,
            });
            const epochEnd = epochData.rowCount > 0 ? epochData.rows[0].epoch_end_ts : "0";
            const ts = parseInt(epochEnd) - 7 * 480;
            const totalVotingPower =
              epochData.rowCount > 0 ? new BigNumber(epochData.rows[0].epoch_total_vp) : new BigNumber(0);
            const tokenVotingPower = new BigNumber(votingPowerFast(ts, 1, map1, sec));
            if (totalVotingPower.isEqualTo(0) || tokenVotingPower.isEqualTo(0)) {
              return {
                epoch: epoch,
                inflationShare: "0",
              };
            } else {
              const epochInflation = new BigNumber(epochData.rowCount > 0 ? epochData.rows[0].epoch_inflation : "0");
              const inflationShare = tokenVotingPower
                .multipliedBy(epochInflation)
                .dividedBy(totalVotingPower)
                .toFixed(0);
              return { epoch: epoch, inflationShare: inflationShare };
            }
          });
          const resultArr = await Promise.all(result);
          return { id: lock.id, unclaimedInflation: resultArr.filter((x) => x.inflationShare !== "0") };
        });
        const finalResponse = await Promise.all(response);
        return res.json(finalResponse);
      } else {
        return res.json([]);
      }
    } catch (e) {
      console.log(e);

      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
