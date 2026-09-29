/** 验收库容器名。默认仍指向开发库，隔离环境用环境变量改。 */
export const PG_CONTAINER = process.env.E2E_PG_CONTAINER || 'mugsun-pg'
export const REDIS_CONTAINER = process.env.E2E_REDIS_CONTAINER || 'blade-redis'
export const REDIS_DB = process.env.E2E_REDIS_DB || '3'
