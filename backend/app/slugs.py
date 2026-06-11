import random
import string
from .wordlists import ADJECTIVES_1, ADJECTIVES_2, NOUNS


def _random_slug() -> str:
    a1 = random.choice(ADJECTIVES_1)
    a2 = random.choice(ADJECTIVES_2)
    n  = random.choice(NOUNS)
    return f"{a1}-{a2}-{n}"


def _suffix() -> str:
    return ''.join(random.choices(string.digits + string.ascii_lowercase, k=3))


def generate_slug(exists_fn, max_attempts: int = 5) -> str:
    """Return a unique slug, using exists_fn(slug) -> bool to check uniqueness."""
    for _ in range(max_attempts):
        slug = _random_slug()
        if not exists_fn(slug):
            return slug
    # Fallback: append a 3-char base36 suffix
    slug = _random_slug() + '-' + _suffix()
    return slug
