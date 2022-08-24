import axios from "axios";
import { Config, Token, TokenType } from "../types";

export const getTokens = async (config: Config): Promise<Token[]> => {
  const tokens = (
    await axios.get(config.configUrl + "/token?type=standard&network=testnet", {
      // todo change to mainnnet
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36",
      },
    })
  ).data;

  return Object.values(tokens);
};

export const getTokenSymbol = (type: TokenType, tokens: Token[]): string => {
  if (type.hasOwnProperty("fa2")) {
    return tokens.find((x) => x.address == type.fa2.address && x.tokenId.toString() == type.fa2.nat.toString()).symbol;
  } else if (type.hasOwnProperty("fa12")) {
    return tokens.find((x) => x.address == type.fa12).symbol;
  } else {
    return "tez";
  }
};
