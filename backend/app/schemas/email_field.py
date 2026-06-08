from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator

_DOMAIN_RE = re.compile(
    r"(?i)^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"
)
_LOCAL_RE = re.compile(r"^[^@\s]+$")


def _validate_app_email(value: object) -> str:
    if not isinstance(value, str):
        raise TypeError("email must be a string")
    s = value.strip()
    if not s or len(s) > 254 or s.count("@") != 1:
        raise ValueError("value is not a valid email address")
    local, domain = s.split("@", 1)
    if not local or len(local) > 64 or not domain:
        raise ValueError("value is not a valid email address")
    if not _LOCAL_RE.match(local):
        raise ValueError("value is not a valid email address")
    if not _DOMAIN_RE.fullmatch(domain):
        raise ValueError("value is not a valid email address")
    return s


AppEmailStr = Annotated[str, AfterValidator(_validate_app_email)]
