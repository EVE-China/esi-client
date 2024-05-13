import fetch from 'node-fetch';
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * @typedef {Object} Type
 * @property {number} type_id type_id
 * @property {string} name type name
 * @property {number} group_id group_id
 * @property {boolean} published published
 * @property {number} volume volume
 * @property {number} packaged_volume packaged_volume
 */

/**
 * @typedef {Object} Region
 * @property {number} region_id region_id
 * @property {string} name
 * @property {string} description
 * @property {Array<number>} constellations
 */

/**
 * @typedef {Object} Structure
 * @property {number} owner_id
 * @property {string} name
 * @property {number} solar_system_id
 * @property {object} [position]
 * @property {number} position.x
 * @property {number} position.y
 * @property {number} position.z
 * @property {number} [type_id]
 */

/**
 * Universe
 */
class Universe {

  #client;

  /**
   * 
   * @param {ESIClient} client 
   */
  constructor(client) {
    this.#client = client;
  }

  /**
   * Get a list of type ids
   * @param {number} [page=1] Which page of results to return Default value : 1
   * @returns {Array<number>}
   */
  types(page) {
    return this.#client.get('/universe/types/', {
      params: { page }
    });
  }

  /**
   * Get information on a type
   * @param {number} typeId An Eve item type ID
   * @returns {Promise<Type>} type type information
   */
  typeById(typeId) {
    return this.#client.get(`/universe/types/${typeId}/`);
  }

  /**
   * Get a list of regions
   * @param {number} [page=1] Which page of results to return Default value : 1
   * @returns {Promise<Array<number>>}
   */
  regions(page) {
    return this.#client.get('/universe/regions/', {
      params: { page }
    });
  }

  /**
   * Get information on a region
   * @param {number} region region
   * @returns {Promise<Region>}
   */
  regionById(region) {
    return this.#client.get(`/universe/regions/${region}/`);
  }
  
  /**
   * List all public structures
   * @param {'market' | 'manufacturing_basic'} filter Only list public structures that have this service online
   * @returns {Promise<Array<number>>}
   */
  structures(filter) {
    return this.#client.get(`/universe/structures/`, {
      params: { filter }
    });
  }

  /**
   * Requires the following scope: esi-universe.read_structures.v1
   * Returns information on requested structure if you are on the ACL. Otherwise, returns “Forbidden” for all inputs.
   * @param {number} id
   * @returns {Promise<Structure>}
   */
  structureById(id) {
    return this.#client.get(`/universe/structures/${id}`);
  }

}

/**
 * @typedef {Object} Order
 * @property {integer} order_id order_id
 * @property {integer} price price
 * @property {integer} system_id system_id
 * @property {integer} type_id type_id
 * @property {boolean} is_buy_order is_buy_order
 * @property {number} location_id
 * @property {number} volume_remain
 * @property {string} issued
 * @property {number} duration
 */


/**
 * @typedef {Object} MarketStatistic
 * @property {number} average average number
 * @property {string} date The date of this historical statistic entry
 * @property {number} highest highest number
 * @property {number} lowest lowest number
 * @property {integer} order_count Total number of orders happened that day
 * @property {integer} volume Total
 */

/**
 * Market
 */
class Market {

  #client;

  /**
   * 
   * @param {ESIClient} client 
   */
  constructor(client) {
    this.#client = client;
  }

  /**
   * Return a list of type IDs that have active orders in the region, for efficient market indexing.
   * @param {number} region 
   * @param {number} [page=1] Which page of results to return Default value : 1
   * @returns {Promise<Array<number>>} types
   */
  regionTypes(region, page) {
    return this.#client.get(`/markets/${region}/types/`, {
      params: { page }
    });
  }

  /**
   * Return a list of orders in a region
   * @param {number} region
   * @param {'buy' | 'sell' | 'all'} [order_type='all']
   * @param {number} [page=1] Which page of results to return Default value : 1
   * @returns {Promise<Array<Order>>} orders
   */
  regionOrders(region, order_type, page) {
    return this.#client.get(`/markets/${region}/orders/`, {
      params: {
        order_type: order_type ? order_type : 'all',
        page: page ? page : 1
      }
    });
  }
  
  /**
   * Return a list of historical market statistics for the specified type in a region
   * @param {integer} region
   * @param {integer} type_id
   * @returns {Promise<Array<MarketStatistic>>} orders
   */
  regionHistory(region, type_id) {
    return this.#client.get(`/markets/${region}/history/`, {
      params: {
        type_id
      }
    });
  }

  /**
   * Requires the following scope: esi-markets.structure_markets.v1
   * Return all orders in a structure
   * @param {number} structure_id
   * @param {number} [page=1] Which page of results to return Default value : 1
   * @returns {Promise<Array<Order>>} orders
   */
  structureOrders(structure_id , page) {
    return this.#client.get(`/markets/structures/${structure_id}/`, {
      params: {
        page: page ? page : 1
      }
    });
  }
}


export default class ESIClient {

  options;

  /**
   * 初始化esi
   * @param {object} options 配置
   * @param {string} [options.baseURL=https://esi.evetech.net] baseURL
   * @param {'legacy' | 'latest' | 'dev'} [options.version=latest] 版本号
   * @param {'en' | 'en-us' | 'de' | 'fr' | 'ja' | 'ru' | 'zh' | 'ko' | 'es'} [options.language] Language to use in the response, takes precedence over Accept-Language
   * @param {string} [options.token] The EVE SSO token
   * @param {'tranquility'} [options.datasource=tranquility] The server name you would like data from
   */
  constructor(options) {
    if (null == options) {
      options = {}
    }
    this.options = {
      baseURL: options.baseURL ? options.baseURL : 'https://esi.evetech.net',
      version: options.version ? options.version : 'latest',
      token: options.token,
      language: options.language ? options.language : 'zh',
      datasource: 'tranquility'
    };
    this.universe = new Universe(this);
    this.market = new Market(this);
  }

  /**
   * http请求
   * @param {string} path 路径, 参考:/universe/regions/
   * @param {object} init 配置
   * @param {'GET' | 'POST'} init.method method
   * @param {Record<string, string>} [init.params] URLSearchParams
   * @param {HeadersInit} [init.headers] headers
   * @param {BodyInit} [init.body] body
   * @returns {Promise<any>} 返回值
   */
  async request(path, init) {
    init = null != init ? init : {};
    let headers = {
      'accept': 'application/json',
      'cache-control': 'no-cache',
      'accept-language': this.options.language
    }
    if (init.headers) {
      headers = { ...headers, ...init.headers };
    }
    if (this.options.token) {
      headers['authorization'] = `Bearer ${this.options.token}`;
    }
    const params = new URLSearchParams();
    params.append('datasource', this.options.datasource);
    if (init.params) {
      for (const key in init.params) {
        if (init.params[key]) {
          params.append(key, init.params[key]);
        }
      }
    }
    let agent = null;
    if (process.env.HTTP_PROXY) {
      agent = new HttpsProxyAgent(process.env.HTTP_PROXY);
    }
    let url = `${this.options.baseURL}/${this.options.version}${path}?${params.toString()}`;
    const rsp = await fetch(url, {
      method: init.method ? init.method : 'GET',
      headers: headers,
      body: init.body ? init.body : undefined,
      agent: agent
    });
    
    let rspBody;
    if ('application/json; charset=UTF-8' === rsp.headers.get('content-type')) {
      rspBody = await rsp.json();
    } else {
      rspBody = await rsp.text();
    }
    if (!rsp.ok) {
      if ('application/json; charset=UTF-8' === rsp.headers.get('content-type')) {
        throw new Error(rspBody.error);
      } else {
        throw new Error(rspBody);
      }
      
    }
    return rspBody;
  }

  /**
   * http get请求
   * @param {string} path 路径, 参考:/universe/regions/
   * @param {object} init 配置
   * @param {Record<string, string>} [init.params] URLSearchParams
   * @param {HeadersInit} [init.headers] headers
   * @param {BodyInit} [init.body] body
   * @returns {Promise<any>} 返回值
   */
  async get(path, init) {
    init = null != init ? init : {};
    return this.request(path, {
      method: 'GET',
      params: init.params,
      headers: init.headers,
      body: init.body,
    });
  }
}