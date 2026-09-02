#!/usr/bin/env bash
#
# verify-lab.sh — quick health check for the three-broker local cluster lab.
#
# Run it from anywhere; it operates on the docker-compose.yml next to this script.
# It checks that all three brokers report healthy and that every host-facing port is
# accepting connections, then prints a pass/fail summary. Exit code is 0 on success,
# 1 if any check failed.
#
#   ./verify-lab.sh
#
set -uo pipefail

cd "$(dirname "$0")" || exit 1

fail=0
if [ -t 1 ]; then g=$'\033[32m'; r=$'\033[31m'; z=$'\033[0m'; else g=; r=; z=; fi
ok()  { printf '  %s✓%s %s\n' "$g" "$z" "$1"; }
bad() { printf '  %s✗%s %s\n' "$r" "$z" "$1"; fail=1; }

echo "Docker Compose"
if docker compose version >/dev/null 2>&1; then
  ok "docker compose v2 present"
else
  bad "docker compose not found — install Docker Compose v2 (the 'docker compose' subcommand)"
  echo
  echo "Cannot continue without Docker Compose."
  exit 1
fi

echo "Brokers"
running="$(docker compose ps --status running --services 2>/dev/null || true)"
for b in kafka-1 kafka-2 kafka-3; do
  if printf '%s\n' "$running" | grep -qx "$b"; then
    health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "kafka-lab-$b" 2>/dev/null || echo unknown)"
    if [ "$health" = healthy ]; then
      ok "$b healthy"
    else
      bad "$b is running but health=$health (give it up to a minute, or check 'docker logs kafka-lab-$b')"
    fi
  else
    bad "$b is not running"
  fi
done

echo "Supporting services"
for s in kafka-ui kafka-exporter prometheus grafana; do
  if printf '%s\n' "$running" | grep -qx "$s"; then
    ok "$s running"
  else
    bad "$s is not running (the Grafana dashboard needs kafka-exporter and prometheus)"
  fi
done

echo "Host ports"
check_port() {
  # bash /dev/tcp — a refused connection returns immediately, no 'nc' or 'timeout' needed.
  if (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null; then
    exec 3>&- 3<&-
    ok "port $1 ($2)"
  else
    bad "port $1 ($2) is not accepting connections"
  fi
}
check_port 29092 "kafka-1 bootstrap"
check_port 29093 "kafka-2 bootstrap"
check_port 29094 "kafka-3 bootstrap"
check_port 8080  "Kafka UI"
check_port 9308  "kafka-exporter"
check_port 9090  "Prometheus"
check_port 3001  "Grafana"

if command -v curl >/dev/null 2>&1; then
  echo "Metrics pipeline"
  if curl -sf --max-time 5 http://127.0.0.1:9308/metrics 2>/dev/null | grep -q '^kafka_brokers '; then
    ok "kafka-exporter is producing kafka_* metrics"
  else
    bad "kafka-exporter is not returning broker metrics — the Grafana dashboard will be empty"
  fi
  # --get --data-urlencode so curl encodes the PromQL braces/quotes itself; passing them
  # raw in the URL triggers curl's {} glob syntax and it errors out (exit 22).
  up="$(curl -sf --max-time 5 --get \
    --data-urlencode 'query=up{job="kafka-exporter"}' \
    http://127.0.0.1:9090/api/v1/query 2>/dev/null || true)"
  if printf '%s' "$up" | grep -q '"value":\[[^]]*,"1"\]'; then
    ok "Prometheus is scraping kafka-exporter"
  else
    bad "Prometheus is not scraping kafka-exporter (target down)"
  fi
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "${g}Lab is up.${z}  Kafka UI http://localhost:8080  ·  Grafana http://localhost:3001"
else
  echo "${r}Some checks failed.${z}  See the Troubleshooting section of local-cluster-lab/README.md."
fi
exit "$fail"
