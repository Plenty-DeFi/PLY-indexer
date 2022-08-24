import { Request, Response, Router } from "express";
import { Dependecies, TokenType } from "../../types";
import { calculateAPR, getMainnetAddress, getRealEmission, getToken } from "../../infrastructure/utils";

function build({ dbClient, contracts, tzktProvider, getData }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const epoch = req.query.epoch as string;
      if (epoch) {
        let pools = [];
        const pool = await dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        });
        if (pool.rowCount !== 0) {
          const finalPoolsPromise = pool.rows.map(async (pool) => {
            const bribes = await dbClient.getAll({
              select: "value, price, name",
              table: "bribes",
              where: `amm='${pool.amm}' AND epoch='${epoch}'`,
            });

            return {
              pool: getMainnetAddress(pool.amm),
              bribes: bribes.rows,
            };
          });

          pools = await Promise.all(finalPoolsPromise);

          return res.json(pools);
        } else {
          return res.json([]);
        }
      } else {
        return res.status(400).json({ message: "epoch not provided" });
      }
    } catch (e) {
      console.log(e);
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
