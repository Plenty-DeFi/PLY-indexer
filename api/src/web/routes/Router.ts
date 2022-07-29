import { Router } from "express";
import LocksRouter from "./LocksRouter";
import LockVotingPowerRouter from "./LockVotingPower";
import PoolsRouter from "./PoolsRouter";

import { Dependecies } from "../../types";

function build(dependencies: Dependecies): Router {
  const router = Router();
  router.use("/locks", LocksRouter(dependencies));
  router.use("/voting-power", LockVotingPowerRouter(dependencies));
  router.use("/pools", PoolsRouter(dependencies));
  return router;
}

export default build;
