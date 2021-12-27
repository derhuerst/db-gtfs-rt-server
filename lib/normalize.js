'use strict'

const cleanStationNameWithLocation = require('db-clean-station-name/lib/with-location')
const cleanStationName = require('db-clean-station-name')
const slugg = require('slugg')
const QuickLRU = require('quick-lru')

// todo: use trainline-eu/stations?
// todo: use db-hafas-stations?
const cache = new QuickLRU({maxSize: 1000})
const normalizeStopName = (name, stop) => {
	if (cache.has(name)) return cache.get(name)

	let normalizedName = stop && stop.location
		? cleanStationNameWithLocation(name, stop.location).short
		: cleanStationName(name)
	normalizedName = slugg(normalizedName)

	cache.set(name, normalizedName)
	return normalizedName
}

// we match hafas-client here
// https://github.com/public-transport/hafas-client/blob/8ed218f4d62a0c220d453b1b1ffa7ce232f1bb83/parse/line.js#L13
// todo: adapt this to the DB data
const normalizeLineName = (name, line) => {
	const pName = line.productName
	if (pName && pName.length > 1 && name.slice(0, pName.length + 1) === pName + ' ') {
		name = name.slice(pName.length + 1)
	} else {
		name = name
		.replace(/^(Bus|STR|Fäh)\s+/gu, '')
		.replace(/^Bus([A-Z]{2,4}\b)/gu, '$1') // "BusOF-91" -> "OF-91"
	}
	name = name.replace(/([a-zA-Z]+)\s+(\d+)/g, '$1$2')
	return slugg(name)
}

module.exports = {
	normalizeStopName,
	normalizeLineName,
}
