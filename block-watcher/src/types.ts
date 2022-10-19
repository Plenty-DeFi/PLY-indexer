export interface Config {
  heartbeatURL: string;
  tzkt: string;
  broadcastAddress: string;
  ports: string;
}

export interface BlockData {
  hash: string;
  timestamp: string;
  level: string;
}
