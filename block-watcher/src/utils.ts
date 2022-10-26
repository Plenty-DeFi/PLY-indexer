import axios from "axios";
import https from "https";
// Retries axios connection every 3 seconds
export const addRetryToAxios = () => {
  axios.defaults.timeout = 30000;
  axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  axios.interceptors.response.use(null, async (error) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log(`
    Error from block watcher
      Axios request error: ${error.message},\n
      URL: ${error.config.url}
      Error: ${error}
    `);
    return axios.request(error.config);
  });
};
