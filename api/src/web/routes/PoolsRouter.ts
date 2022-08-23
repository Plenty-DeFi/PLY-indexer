import { Request, Response, Router } from "express";
import { Dependecies, TokenType } from "../../types";
import BigNumber from "bignumber.js";
import { calculateAPR, getMainnetAddress, getRealEmission, getToken } from "../../infrastructure/utils";

function build({ dbClient, config, contracts, tzktProvider, getData }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const tokens = (await getData()).tokens;
      const amm = req.query.amm as string;
      if (amm) {
        const pools = await dbClient.get({
          select: "*",
          table: "pools",
          where: `amm='${amm}'`,
        });
        if (pools.rowCount !== 0) {
          const currentEpoch = await tzktProvider.getCurrentEpoch(contracts.voter.address);
          const bribes = await tzktProvider.getBribes(pools.rows[0].bribe_bigmap, currentEpoch);
          const bribeFinal = bribes.map((data: { value: string; type: TokenType }) => {
            const name = getToken(data.type, tokens);
            return {
              value: data.value,
              name,
            };
          });
          const realEmission = await getRealEmission(tzktProvider, contracts);
          const apr = await calculateAPR(contracts, tzktProvider, pools.rows[0], currentEpoch, realEmission);
          const pool = pools.rows[0];
          return res.json({
            pool: getMainnetAddress(pool.type),
            bribes: bribeFinal,
            apr,
            previousApr: 0,
          });
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
            const bribeFinal = bribes.map((data: { value: string; type: TokenType }) => {
              const name = getToken(data.type, tokens);
              return {
                value: data.value,
                name,
              };
            });
            const apr = await calculateAPR(contracts, tzktProvider, pool, currentEpoch, realEmission);
            return {
              pool: getMainnetAddress(pool.type),
              bribes: bribeFinal,
              apr,
              previousApr: 0,
            };
          });

          pools = await Promise.all(finalPoolsPromise);

          return res.json(pools);
        } else {
          return res.json([]);
        }
      }
    } catch (e) {
      console.log(e);
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
