import { Request, Response, Router } from "express";
import { Dependecies } from "../../types";

function build({ dbClient }: Dependecies): Router {
  const router = Router();
  router.get("/", async (req: Request, res: Response) => {
    const address = req.query.address as string;
    const token_id = req.query.token_id as string;
    if (!address && !token_id) {
      return res.status(400).json({ message: "MISSING_ADDRESS_OR_ID" });
    }
    let locks;
    if (address && !token_id) {
      locks = await dbClient.get({
        select: "*",
        table: "locks",
        where: `owner='${address}'`,
      });
    } else if (!address && token_id) {
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

    return res.json({ result: locks.rows });
  });
  return router;
}

export default build;
