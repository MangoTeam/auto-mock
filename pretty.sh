#!/bin/sh


# usage: ./pretty.sh <json file to make pretty>

jq '.' $1 > _tmp.json
mv _tmp.json $1