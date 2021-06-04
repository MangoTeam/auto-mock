#!/bin/bash

# usage: ./bench.sh <root> <particular> <filter> <remaining args>
# example: ./bench.sh synthetic 2-2-boxes hier --loclearn=bayesian
# unambiguous: ./bench.sh synthetic 2-2-boxes hier --unambig

arg=".[\"$1\"] | .[\"$2\"] "

hlarg="$arg | .[\"height\"] | .[\"low\"]"
hharg="$arg | .[\"height\"] | .[\"high\"]"
wlarg="$arg | .[\"width\"] | .[\"low\"]"
wharg="$arg | .[\"width\"] | .[\"high\"]"

hlo=$(jq "$hlarg" benches.json)
hhi=$(jq "$hharg" benches.json)
wlo=$(jq "$wlarg" benches.json)
whi=$(jq "$wharg" benches.json)

# echo [[ -z $lo ]]

# echo "$(expr $lo)"

# if [ -z $(expr $lo) ]; then
#   echo "bad usage, $1[$2][width][low/high] not found in benches.json"
# fi

npm run-script mock -- --filter "$3" --fp "$2.json" --hrange "$hlo" "$hhi" --wrange "$wlo" "$whi" --debug "${@:4}"

# exit 0
