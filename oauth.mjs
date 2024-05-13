import randomstring from "randomstring";
import { createHash } from "node:crypto";
import { exec } from "node:child_process";
import http from "node:http";
import nodeUrl from "node:url";
import fs from "node:fs";
import fetch from 'node-fetch';
import { HttpsProxyAgent } from "https-proxy-agent";
import { jwtDecode } from "jwt-decode";

let agent = null;
if (process.env.HTTP_PROXY) {
  agent = new HttpsProxyAgent(process.env.HTTP_PROXY);
}

function generateCodeVerifier() {
  return Buffer.from(randomstring.generate(32)).toString('base64url');
}

function generateCodeChallenge(code_verifier) {
  return createHash('sha256').update(code_verifier).digest('base64url');
}

/**
 * 这里我只支持了windows平台, 其他平台我用不到
 * @param {*} url 
 */
function openUrl(url) {
  exec(`start "" "${url}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
  });
}

/**
 * 校验jwt是否有效
 * @param {string} access_token 
 */
async function validateJwt(access_token) {
  const jwt = jwtDecode(access_token);
  if (!jwt || !jwt.exp) {
    return false;
  }

  // 判断是否过期
  const now = (new Date().getTime() / 1000).toFixed(0);
  if (now < jwt.exp) {
    return true;
  }
}

async function refreshAccessToken(config, refresh_oken) {
  const rsp = await fetch('https://login.eveonline.com/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': 'login.eveonline.com'
    },
    body: `grant_type=refresh_token&refresh_token=${refresh_oken}&client_id=${config.client_id}`
  });
  const rspJson = await rsp.json();
  saveTokenToCache(rspJson);
  return rspJson;
}

/**
 * 
 * @returns {OAuthResponse}
 */
function getTokenFromCache(config) {
  if (fs.existsSync('.eve_oauth_cache')) {
    const value = fs.readFileSync('.eve_oauth_cache');
    if (0 == value.length) {
      return undefined;
    }
    const json = JSON.parse(value.toString());
    if (json && json.access_token) {
      if (validateJwt(json.access_token)) {
        return json;
      } else if (json.refresh_token) {
        // 刷新令牌
        return refreshAccessToken(config, json.refresh_token);
      }
    }
    return undefined;
  }
  return undefined;
}

function saveTokenToCache(token) {
  fs.writeFileSync('.eve_oauth_cache', JSON.stringify(token));
}

/**
 * @typedef {Object} OAuthResponse
 * @property {object} access_token
 * @property {number} access_token.exp the expiry date of the token as a UNIX timestamp
 * @property {number} expires_in
 * @property {string} token_type
 * @property {string} refresh_token
 */

/**
 * 发起一次请求用于获取token
 * @param {object} config
 * @param {string} [config.host] host, default https://login.eveonline.com
 * @param {string} config.redirect_uri your application's defined callback
 * @param {string} config.client_id client_id
 * @param {string} config.scope space delimited list of ESI scopes you would like to request permissions for
 * @returns {Promise<OAuthResponse>}
 */
export async function requestByNative(config) {
  // 从缓存中获取
  let token = getTokenFromCache(config);
  if (undefined != token) {
    return token;
  }
  
  // 重新获取
  const host = config.host ? config.host : 'https://login.eveonline.com';
  let url = host + '/v2/oauth/authorize/';
  url += `?response_type=code`;
  const redirect_uri = encodeURIComponent(config.redirect_uri);
  url += `&redirect_uri=${redirect_uri}`;
  url += `&client_id=${config.client_id}`;
  const scope = encodeURIComponent(config.scope);
  url += `&scope=${scope}`;
  const code_verifier = generateCodeVerifier();
  const code_challenge = generateCodeChallenge(code_verifier);
  url += `&code_challenge=${code_challenge}`;
  url += `&code_challenge_method=S256`;
  const state = randomstring.generate(10);
  url += `&state=${state}`;

  const server = http.createServer();
  const codePromise = new Promise((resolve, reject) => {
    server.on('request', (req, rsp) => {
      if (!req.url) {
        console.log('req.url is empty');
        rsp.end();
        return;
      }
      const query = nodeUrl.parse(req.url, true).query;
      if (query.state !== state) {
        rsp.end();
        return;
      }
      if (!query.code) {
        rsp.end();
        return;
      }
      rsp.end('oauth success!');
      resolve(query.code);
    });
    server.on('error', err => {
      reject(err);
    });
  });
  server.listen(3001);
  openUrl(url);
  const code = await codePromise;
  server.close();
  let form = `grant_type=authorization_code`;
  form += `&client_id=${config.client_id}`;
  form += `&code=${code}`;
  form += `&code_verifier=${code_verifier}`;
  const rsp = await fetch('https://login.eveonline.com/v2/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': 'login.eveonline.com',
      'User-Agent': 'esi client 0.0.1'
    },
    agent: agent,
    body: form
  });
  if (rsp.status != 200) {
    console.error(rsp);
    throw new Error(rsp.statusText);
  }
  const rspJson = await rsp.json();
  saveTokenToCache(rspJson);
  return rspJson;
};