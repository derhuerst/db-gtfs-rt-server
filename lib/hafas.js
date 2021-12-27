'use strict'

const socksAgentWithSocketTTL = require('@derhuerst/socks-agent-with-socket-ttl')
// todo: use db-hafas?
const _dbProfile = require('hafas-client/p/db')
const {parseHook} = require('hafas-client/lib/profile-hooks')
const withThrottling = require('hafas-client/throttle')
const createHafas = require('hafas-client')
const Redis = require('ioredis')
const withCaching = require('cached-hafas-client')
const createRedisStore = require('cached-hafas-client/stores/redis')

const torSocksAgent = socksAgentWithSocketTTL({
        host: '127.0.0.1',
        port: 9050,
        socketTTL: 30 * 1000, // 30s
})

const transformReq = (ctx, req) => {
        req.agent = torSocksAgent
        req.headers['connection'] = 'keep-alive'
        return req
}

const parseLineWithMatchId = ({parsed, common}, l) => {
	const matchId = l.prodCtx && l.prodCtx.matchId
	if (parsed.productName === 'ICE' && matchId) {
		parsed.name = matchId
	}
	return parsed
}

const dbProfile = {
	..._dbProfile,
	parseLine: parseHook(_dbProfile.parseLine, parseLineWithMatchId),
	transformReq,
}

const rawHafas = createHafas(
	withThrottling(dbProfile, 25, 1000), // 25 req/s
	'db-gtfs-rt-server-example', // todo
)

const redisOpts = {}
if (process.env.REDIS_URL) {
	const url = new URL(process.env.REDIS_URL)
	redisOpts.host = url.hostname || 'localhost'
	redisOpts.port = url.port || '6379'
	if (url.password) redisOpts.password = url.password
	if (url.pathname && url.pathname.length > 1) {
		redisOpts.db = parseInt(url.pathname.slice(1))
	}
}
const redis = new Redis(redisOpts)

const hafas = withCaching(rawHafas, createRedisStore(redis))

// todo: expose a way to close the Redis client
module.exports = hafas
