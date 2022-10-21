import axios from "axios";
import * as https from "https";

// Retries axios connection every 3 seconds
export const addRetryToAxios = () => {
  axios.defaults.timeout = 30000;
  axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  axios.interceptors.response.use(null, async (error) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log(`
    Error from API \n
      Axios request error: ${error.message},\n
      URL: ${error.config.url}
    `);
    return axios.request(error.config);
  });
};
