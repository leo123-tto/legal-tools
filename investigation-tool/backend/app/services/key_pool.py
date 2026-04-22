from __future__ import annotations


class KeyPool:
    """支持轮换的 Key 池，自动跳过失效 Key。"""

    def __init__(self, keys: str | list[str]) -> None:
        if isinstance(keys, str):
            keys = [k.strip() for k in keys.split(",") if k.strip()]
        self._keys: list[str] = keys
        self._index: int = 0

    @property
    def is_empty(self) -> bool:
        return len(self._keys) == 0

    def current(self) -> str:
        if self.is_empty:
            raise ValueError("Key pool is empty")
        return self._keys[self._index]

    def rotate(self) -> str:
        """切换到下一个 Key，返回新的当前 Key。"""
        if len(self._keys) > 1:
            self._index = (self._index + 1) % len(self._keys)
        return self.current()

    def peek_next(self) -> str:
        """预览下一个 Key（不切换）。"""
        if len(self._keys) <= 1:
            return self.current()
        return self._keys[(self._index + 1) % len(self._keys)]

    def __len__(self) -> int:
        return len(self._keys)

    def __repr__(self) -> str:
        return f"KeyPool({self._keys[self._index][:8]}... [{len(self)} keys], idx={self._index})"
