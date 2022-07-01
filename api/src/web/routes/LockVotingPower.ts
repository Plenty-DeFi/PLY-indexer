import { Request, Response, Router } from "express";
import { Dependecies, Lock } from "../../types";
import { votingPower } from "../../infrastructure/utils";

function build({ dbClient, config, contracts }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    try {
      const at = req.query.at as string;
      const token_id = req.query.token_id as string;
      if (!at || !token_id) {
        return res.status(400).json({ message: "MISSING_ADDRESS_OR_ID" });
      } else {
        const lock = await dbClient.get({
          select: "*",
          table: "locks",
          where: `id=${token_id}`,
        });
        if (lock.rowCount !== 0) {
          const lockVotingPower = await votingPower(lock.rows[0].id, parseInt(at), 1);
          return res.json({ lockVotingPower });
        } else {
          return res.status(400).json({ message: "TOKEN_ID_NOT_EXIST" });
        }
      }
    } catch (e) {
      return res.status(400).json({ message: e });
    }
  });
  return router;
}

export default build;
