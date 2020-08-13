#!/bin/sh


# usage: ./pretty.sh <json file to make pretty>

jq '.' $1 > tmp
mv tmp $1