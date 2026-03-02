import axios from 'axios';
import { config } from './config.js';

export const http = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 20000,
});

export const setAuthToken = (token) => {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete http.defaults.headers.common.Authorization;
  }
};

