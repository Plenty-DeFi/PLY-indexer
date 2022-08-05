import { Request, Response, Router } from "express";
import { Dependecies } from "../../types";
import BigNumber from "bignumber.js";
import { calculateAPR, getPrice, getRealEmission, getTokenDecimal } from "../../infrastructure/utils";

function build({ dbClient, config, contracts, tzktProvider }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const amm = req.query.amm as string;
      if (amm) {
        const pool = await dbClient.get({
          select: "*",
          table: "pools",
          where: `amm='${amm}'`,
        });
        if (pool.rowCount !== 0) {
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const bribes = await tzktProvider.getBribes(pool.rows[0].bribe_bigmap, currentEpoch);
          const realEmission = await getRealEmission(tzktProvider, contracts);

          const apr = await calculateAPR(contracts, tzktProvider, pool.rows[0], currentEpoch, realEmission);

          return res.json({ ...pool.rows[0], bribes, apr });
        } else {
          return res.status(400).json({ message: "AMM_NOT_EXIST" });
        }
      } else {
        let pools = [];
        const pool = await dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        });
        if (pool.rowCount !== 0) {
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const realEmission = await getRealEmission(tzktProvider, contracts);
          const finalPoolsPromise = pool.rows.map(async (pool) => {
            const bribes = await tzktProvider.getBribes(pool.bribe_bigmap, currentEpoch);
            const apr = await calculateAPR(contracts, tzktProvider, pool, currentEpoch, realEmission);
            return {
              ...pool,
              bribes,
              apr,
            };
          });

          pools = await Promise.all(finalPoolsPromise);

          return res.json(pools);
        } else {
          return res.json([]);
        }
      }
    } catch (e) {
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
