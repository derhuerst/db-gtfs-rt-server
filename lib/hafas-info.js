'use strict'

const {
	normalizeStopName,
	normalizeLineName,
} = require('./normalize')

const hafasInfo = {
	endpointName: 'db-hafas',
	normalizeStopName,
	normalizeLineName,
}

module.exports = hafasInfo
