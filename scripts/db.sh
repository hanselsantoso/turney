#!/usr/bin/env bash
# Project-local Postgres (no Docker needed). Data lives in .pgdata, port 5433.
set -e
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
case "${1:-start}" in
  init)
    initdb -D .pgdata -U tm --auth=trust --encoding=UTF8
    pg_ctl -D .pgdata -l .pgdata/log -o "-p 5433" start
    sleep 2
    createdb -p 5433 -U tm tournament
    createdb -p 5433 -U tm tournament_test
    ;;
  start) pg_ctl -D .pgdata -l .pgdata/log -o "-p 5433" start ;;
  stop)  pg_ctl -D .pgdata stop ;;
  status) pg_ctl -D .pgdata status ;;
  *) echo "usage: db.sh [init|start|stop|status]"; exit 1 ;;
esac
