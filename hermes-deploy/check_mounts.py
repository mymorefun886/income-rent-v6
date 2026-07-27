import json, subprocess

for container in ["hermes-postgres", "hermes-qdrant", "hermes-redis"]:
    print(f"=== {container} ===")
    result = subprocess.run(["docker", "inspect", container], capture_output=True, text=True)
    data = json.loads(result.stdout)
    for m in data[0]["Mounts"]:
        print(f"  {m['Source']} -> {m['Destination']}")
