#!/bin/bash

# usage: ./bench_hier.sh <root> <particular> <remaining args>
# example: ./bench_hier.sh hackernews hn-posts --train-size 5 --rows 3 --alg base --timeout 60

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

# echo "$hlo"
# echo "$(expr $lo)"

# if [ -z $(expr $lo) ]; then
#   echo "bad usage, $1[$2][width][low/high] not found in benches.json"
# fi

npm run-script hier --  --fp "$2.json" --hrange "$hlo" "$hhi" --wrange "$wlo" "$whi" --debug "${@:3}"

# exit 0
