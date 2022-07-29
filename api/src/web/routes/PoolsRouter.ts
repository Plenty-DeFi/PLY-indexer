import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";
import { votingPower } from "../../infrastructure/utils";

function build({ dbClient, config, contracts }: Dependecies): Router {
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
          return res.json(pool.rows[0]);
        } else {
          return res.status(400).json({ message: "AMM_NOT_EXIST" });
        }
      } else {
        const pool = await dbClient.getAllNoQuery({
          select: "*",
          table: "pools",
        });

        return res.json(pool.rows);
      }
    } catch (e) {
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
