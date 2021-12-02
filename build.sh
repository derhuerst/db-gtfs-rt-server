#!/bin/bash

set -e
set -o pipefail
set -x

>&2 echo "Checking if GTFS was already imported..."
if [[ $(psql -t -c 'SELECT 1 FROM agency LIMIT 1') ]]
then
    >&2 echo "GTFS data already imported, skipping build.sh"
    exit 0
fi

wget -O gtfs.zip 'https://de.data.public-transport.earth/gtfs-germany.zip'
unzip -o -d gtfs -j gtfs.zip

env | grep '^PG'

NODE_ENV=production node_modules/.bin/gtfs-to-sql -d --trips-without-shape-id -- \
	gtfs/agency.txt \
	gtfs/calendar.txt \
	gtfs/calendar_dates.txt \
	gtfs/frequencies.txt \
	gtfs/routes.txt \
	gtfs/stop_times.txt \
	gtfs/stops.txt \
	gtfs/transfers.txt \
	gtfs/trips.txt \
	| psql -b

lib="$(dirname $(realpath $0))/lib"
NODE_ENV=production node_modules/.bin/build-gtfs-match-index \
	$lib/hafas-info.js $lib/gtfs-info.js \
	| psql -b
