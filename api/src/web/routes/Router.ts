import { Router } from "express";
import LocksRouter from "./LocksRouter";

import { Dependecies } from "../../types";

function build(dependencies: Dependecies): Router {
  const router = Router();
  router.use("/locks", LocksRouter(dependencies));
  router.use("/voting-power", LocksRouter(dependencies));
  return router;
}

export default build;
