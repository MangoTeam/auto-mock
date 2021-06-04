#!/bin/sh

export PIPENV_PIPFILE=../mockdown/Pipfile
LOGLEVEL=INFO timeout 1800 pipenv run -- mockdown run -pb 825 2550 925 2600 -pm hierarchical --learning-method noisetolerant -dn 0 tmp.json response.json