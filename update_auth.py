import yaml

with open("/opt/data/config.yaml", "r") as f:
    config = yaml.safe_load(f)

config["dashboard"] = {
    "basic_auth": {
        "username": "morefun886",
        "password_hash": "scrypt$16384$8$1$GgUBgcZLhrgNmiSVsAmNqA==$mEjK0cX1YG/2Z5jh+LwmZC0coT3WnGiFHRYXnUnXqqI="
    }
}

with open("/opt/data/config.yaml", "w") as f:
    yaml.dump(config, f, default_flow_style=False, allow_unicode=True)

print("Credentials updated")
