import axios from "axios";

// Retries axios connection every 3 seconds
export const addRetryToAxios = () => {
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
