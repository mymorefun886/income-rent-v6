import yaml

with open("/opt/data/config.yaml", "r") as f:
    config = yaml.safe_load(f)

config["dashboard"] = {
    "basic_auth": {
        "username": "admin",
        "password_hash": 'scrypt$16384$8$1$73n9pqI2fvebOGLAXzoH7A==$3HUqkvDSiaA5OTG5pnvJ6xgSbI1SF+2lYQnXQH/UJbs='
    }
}

with open("/opt/data/config.yaml", "w") as f:
    yaml.dump(config, f, default_flow_style=False, allow_unicode=True)

print("Config fixed")
