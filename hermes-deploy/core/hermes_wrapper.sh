#!/bin/bash
echo "=== HERMES WRAPPER ===" >> /tmp/hermes_wrapper.log
echo "Time: $(date)" >> /tmp/hermes_wrapper.log
echo "Args: $@" >> /tmp/hermes_wrapper.log
echo "Env KEY: ${OPENCODE_GO_API_KEY:0:15}..." >> /tmp/hermes_wrapper.log
echo "PWD: $(pwd)" >> /tmp/hermes_wrapper.log
echo "---" >> /tmp/hermes_wrapper.log
exec /opt/hermes/.venv/bin/hermes.real "$@"
