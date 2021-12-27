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

// The DELFI GTFS dataset just contains the *full name*, not the abbreviation
// of each agency. match-gtfs-rt-to-gtfs will generate stable route IDs using
// that full name, so we use it here as the ID.
// Also it splits agencies into orgnisational units (or sub-companies?), e.g.
// Hochbahn AG in Hamburg into "Hochbahn Bus" & "Hochbahn U-Bahn".
const bvg = {
	type: 'operator',
	id: 'berliner-verkehrsbetriebe',
	name: 'Berliner Verkehrsbetriebe',
}
const hochbahnBus = {
	type: 'operator',
	id: 'hochbahn-bus',
	name: 'Hochbahn',
}
const hochbahnUbahn = {
	type: 'operator',
	id: 'hochbahn-u-bahn',
	name: 'Hochbahn',
}
const vhhBus = {
	type: 'operator',
	id: 'vhh-bus',
	name: 'Verkehrsbetriebe Hamburg-Holstein',
}
const operatorsByAdmin = Object.assign(Object.create(null), {
	'vbbbvb': bvg, // bus
	'vbbbvt': bvg, // tram
	'vbbbvu': bvg, // subway
	'vbbbvf': bvg, // ferry
	'hvvhha': hochbahnBus,
	// todo: hvvhad (e.g. "Fäh 72")
	'hvv001': hochbahnUbahn,
	'hvvvhh': vhhBus,
	// todo: add operators in other cities
	// related: https://github.com/derhuerst/pan-european-public-transport/blob/9fcf080d08f614559e24ebcc479119ce3a9ad9b4/lib/db.js#L185-L195
	// related: https://github.com/derhuerst/pan-european-public-transport/blob/9fcf080d08f614559e24ebcc479119ce3a9ad9b4/lib/hvv.js#L43-L53
})

const parseLineWithMatchIdAndOperator = ({parsed, common}, l) => {
	const matchId = l.prodCtx && l.prodCtx.matchId
	if (parsed.productName === 'ICE' && matchId) {
		parsed.name = matchId
	}

	const admin = l.prodCtx && l.prodCtx.admin && l.prodCtx.admin.toLowerCase()
	if (admin && operatorsByAdmin[admin]) {
		parsed.operator = operatorsByAdmin[admin]
	}

	return parsed
}

const dbProfile = {
	..._dbProfile,
	parseLine: parseHook(_dbProfile.parseLine, parseLineWithMatchIdAndOperator),
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
