#!/usr/bin/env bash
#
# Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
# https://norbert.com.es/
#

#
REAL="$(realpath "$0")"
DIR="$(dirname "$REAL")"
PROJ="$(realpath "${DIR}/../")"
BASE="$(basename "$REAL")"
NAME="$(basename "$REAL" .sh)"
SCRIPT="${PROJ}/js/erase"
MAIN="${SCRIPT}/main.js"
CONFIG="${PROJ}/config/erase.json"

#
NODE="node"
NODE="`which $NODE 2>/dev/null`"

if [[ $? -ne 0 ]]; then
	echo "Unable to find the \`node\` interpreter!" >&2
	exit 1
fi

#
CMD="'${NODE}' '${MAIN}' --base '${NAME}' --project '${PROJ}' --script '${SCRIPT}' --config '${CONFIG}'"

for i in "$@"; do
	CMD="${CMD} '$i'"
done

#
eval "$CMD"

