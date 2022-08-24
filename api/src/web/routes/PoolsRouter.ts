import { Request, Response, Router } from "express";
import { Dependecies, TokenType } from "../../types";
import { calculateAPR, getMainnetAddress, getRealEmission, getToken } from "../../infrastructure/utils";

function build({ dbClient, contracts, tzktProvider, getData, getAPR }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const tokens = (await getData()).tokens;
      const APRs = await getAPR();
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
          const pool = pools.rows[0];
          return res.json({
            pool: getMainnetAddress(pool.amm),
            bribes: bribeFinal,
            apr: APRs[pool.amm] || 0,
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
          const finalPoolsPromise = pool.rows.map(async (pool) => {
            const bribes = await tzktProvider.getBribes(pool.bribe_bigmap, currentEpoch);
            const bribeFinal = bribes.map((data: { value: string; type: TokenType }) => {
              const name = getToken(data.type, tokens);
              return {
                value: data.value,
                name,
              };
            });
            const apr = APRs[pool.amm] || 0;
            return {
              pool: getMainnetAddress(pool.amm),
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
