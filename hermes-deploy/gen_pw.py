import secrets
import string

chars = string.ascii_letters + string.digits + "!@#%&*-_=+"
pg = "".join(secrets.choice(chars) for _ in range(24))
cs = "".join(secrets.choice(chars) for _ in range(20))
print(f"POSTGRES_PASSWORD={pg}")
print(f"CODE_SERVER_PASSWORD={cs}")
