#!/bin/sh

export PIPENV_PIPFILE=../mockdown/Pipfile
LOGLEVEL=INFO timeout 0 pipenv run -- mockdown run -pb 450 400 1000 1200 -pm hierarchical --learning-method noisetolerant -dn 0 tmp.json response.json