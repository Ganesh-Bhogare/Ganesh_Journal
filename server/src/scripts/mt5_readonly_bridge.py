#!/usr/bin/env python3
"""
Read-only MT5 bridge for Ganesh Journal funded account sync.

What it does:
- Connects to local MT5 terminal
- Reads closed deals
- Builds trade payloads
- Pushes to /api/funded/sync-readonly with x-bridge-token

Safety:
- Read-only sync only
- No trade execution calls
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import requests
except Exception as exc:  # pragma: no cover
    raise RuntimeError("Missing dependency: requests. Install with: pip install requests") from exc

try:
    import MetaTrader5 as mt5
except Exception as exc:  # pragma: no cover
    raise RuntimeError("Missing dependency: MetaTrader5. Install with: pip install MetaTrader5") from exc


@dataclass
class BridgeConfig:
    api_url: str
    bridge_token: str
    provider: str
    account_id: str
    poll_seconds: int
    lookback_days: int
    state_file: Path

    mt5_login: int
    mt5_password: str
    mt5_server: str
    mt5_path: Optional[str]


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        k, v = stripped.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def iso_utc(ts: int) -> str:
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()


def to_state(path: Path) -> Dict[str, Any]:
    if not path.exists():
        return {"last_ticket": 0}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"last_ticket": 0}


def save_state(path: Path, state: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


def read_config() -> BridgeConfig:
    env_file = Path(os.environ.get("FUNDED_BRIDGE_ENV", "server/src/scripts/funded_bridge.env"))
    load_env_file(env_file)

    api_url = os.environ.get("BRIDGE_API_URL", "http://localhost:4000/api/funded/sync-readonly").strip()
    bridge_token = os.environ.get("FUNDED_BRIDGE_TOKEN", "").strip()
    provider = os.environ.get("FUNDED_PROVIDER", "Goat Funded Trader").strip()

    mt5_login_raw = os.environ.get("MT5_LOGIN", "").strip()
    mt5_password = os.environ.get("MT5_PASSWORD", "").strip()
    mt5_server = os.environ.get("MT5_SERVER", "").strip()
    mt5_path = os.environ.get("MT5_PATH", "").strip() or None

    if not mt5_login_raw or not mt5_password or not mt5_server:
        raise ValueError("MT5_LOGIN, MT5_PASSWORD and MT5_SERVER are required")
    if not bridge_token:
        raise ValueError("FUNDED_BRIDGE_TOKEN is required")

    mt5_login = int(mt5_login_raw)
    account_id = os.environ.get("FUNDED_ACCOUNT_ID", str(mt5_login)).strip()
    poll_seconds = int(os.environ.get("BRIDGE_POLL_SECONDS", "20"))
    lookback_days = int(os.environ.get("BRIDGE_LOOKBACK_DAYS", "5"))
    state_file = Path(os.environ.get("BRIDGE_STATE_FILE", "server/src/scripts/.funded_bridge_state.json"))

    return BridgeConfig(
        api_url=api_url,
        bridge_token=bridge_token,
        provider=provider,
        account_id=account_id,
        poll_seconds=max(5, poll_seconds),
        lookback_days=max(1, lookback_days),
        state_file=state_file,
        mt5_login=mt5_login,
        mt5_password=mt5_password,
        mt5_server=mt5_server,
        mt5_path=mt5_path,
    )


def initialize_mt5(cfg: BridgeConfig) -> None:
    # Try explicit path first, then default init, then common Windows install paths.
    candidate_paths: List[Optional[str]] = []
    if cfg.mt5_path:
        candidate_paths.append(cfg.mt5_path)
    candidate_paths.append(None)
    candidate_paths.extend([
        "C:/Program Files/MetaTrader 5/terminal64.exe",
        "C:/Program Files/MetaTrader 5/terminal.exe",
        "C:/Program Files (x86)/MetaTrader 5/terminal64.exe",
        "C:/Program Files (x86)/MetaTrader 5/terminal.exe",
    ])

    ok = False
    for p in candidate_paths:
        ok = mt5.initialize(path=p) if p else mt5.initialize()
        if ok:
            break

    if not ok:
        err = mt5.last_error()
        raise RuntimeError(
            "MT5 initialize failed: "
            f"{err}. Ensure MetaTrader 5 desktop terminal is installed/open, "
            "or set MT5_PATH in funded_bridge.env to terminal64.exe"
        )

    authorized = mt5.login(cfg.mt5_login, password=cfg.mt5_password, server=cfg.mt5_server)
    if not authorized:
        raise RuntimeError(f"MT5 login failed: {mt5.last_error()}")


def build_trade_payloads(cfg: BridgeConfig, state: Dict[str, Any]) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=cfg.lookback_days)

    deals = mt5.history_deals_get(since, now)
    if deals is None:
        raise RuntimeError(f"history_deals_get failed: {mt5.last_error()}")

    by_position: Dict[int, List[Any]] = {}
    for d in deals:
        pid = int(getattr(d, "position_id", 0) or 0)
        if pid <= 0:
            continue
        by_position.setdefault(pid, []).append(d)

    last_ticket = int(state.get("last_ticket", 0) or 0)
    rows: List[Dict[str, Any]] = []

    for pid, items in by_position.items():
        items.sort(key=lambda x: int(getattr(x, "time", 0)))

        opens = [
            d for d in items
            if int(getattr(d, "entry", -1)) in (getattr(mt5, "DEAL_ENTRY_IN", 0), getattr(mt5, "DEAL_ENTRY_INOUT", 2))
        ]
        closes = [
            d for d in items
            if int(getattr(d, "entry", -1)) == getattr(mt5, "DEAL_ENTRY_OUT", 1)
        ]

        if not opens or not closes:
            continue

        open_deal = opens[0]
        for close_deal in closes:
            ticket = int(getattr(close_deal, "ticket", 0) or 0)
            if ticket <= last_ticket:
                continue

            side = "buy" if int(getattr(open_deal, "type", -1)) == getattr(mt5, "DEAL_TYPE_BUY", 0) else "sell"

            rows.append({
                "ticket": str(ticket),
                "symbol": str(getattr(close_deal, "symbol", "") or getattr(open_deal, "symbol", "")),
                "side": side,
                "openTime": iso_utc(int(getattr(open_deal, "time", 0))),
                "openPrice": float(getattr(open_deal, "price", 0.0) or 0.0),
                "closeTime": iso_utc(int(getattr(close_deal, "time", 0))),
                "closePrice": float(getattr(close_deal, "price", 0.0) or 0.0),
                "volume": float(getattr(close_deal, "volume", 0.0) or getattr(open_deal, "volume", 0.0) or 0.0),
                "sl": float(getattr(open_deal, "sl", 0.0) or 0.0),
                "tp": float(getattr(open_deal, "tp", 0.0) or 0.0),
                "profit": float(getattr(close_deal, "profit", 0.0) or 0.0),
                "swap": float(getattr(close_deal, "swap", 0.0) or 0.0),
                "commission": float(getattr(close_deal, "commission", 0.0) or 0.0),
            })

    rows.sort(key=lambda r: int(r["ticket"]))
    return rows


def build_open_positions_payloads() -> List[Dict[str, Any]]:
    positions = mt5.positions_get()
    if positions is None:
        raise RuntimeError(f"positions_get failed: {mt5.last_error()}")

    rows: List[Dict[str, Any]] = []
    for p in positions:
        side = "buy" if int(getattr(p, "type", -1)) == getattr(mt5, "POSITION_TYPE_BUY", 0) else "sell"
        rows.append({
            "ticket": str(int(getattr(p, "ticket", 0) or 0)),
            "symbol": str(getattr(p, "symbol", "") or ""),
            "side": side,
            "openTime": iso_utc(int(getattr(p, "time", 0) or 0)),
            "openPrice": float(getattr(p, "price_open", 0.0) or 0.0),
            "currentPrice": float(getattr(p, "price_current", 0.0) or 0.0),
            "volume": float(getattr(p, "volume", 0.0) or 0.0),
            "sl": float(getattr(p, "sl", 0.0) or 0.0),
            "tp": float(getattr(p, "tp", 0.0) or 0.0),
            "unrealizedPnl": float(getattr(p, "profit", 0.0) or 0.0),
        })

    return rows


def push_sync(cfg: BridgeConfig, trades: List[Dict[str, Any]], open_positions: List[Dict[str, Any]]) -> Dict[str, Any]:
    payload = {
        "accountId": cfg.account_id,
        "server": cfg.mt5_server,
        "provider": cfg.provider,
        "trades": trades,
        "openPositions": open_positions,
    }

    resp = requests.post(
        cfg.api_url,
        json=payload,
        headers={"x-bridge-token": cfg.bridge_token},
        timeout=30,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"Sync failed ({resp.status_code}): {resp.text[:500]}")

    return resp.json() if resp.content else {"success": True}


def run_once(cfg: BridgeConfig) -> None:
    state = to_state(cfg.state_file)
    trades = build_trade_payloads(cfg, state)
    open_positions = build_open_positions_payloads()

    if not trades and not open_positions:
        print("[bridge] No new closed trades and no open positions to sync")
        return

    result = push_sync(cfg, trades, open_positions)
    if trades:
        max_ticket = max(int(t["ticket"]) for t in trades)
        state["last_ticket"] = max_ticket
        save_state(cfg.state_file, state)

    print(f"[bridge] Synced {len(trades)} closed trades and {len(open_positions)} open positions | result={result}")


def main() -> int:
    parser = argparse.ArgumentParser(description="MT5 funded read-only bridge")
    parser.add_argument("--once", action="store_true", help="Run one sync cycle and exit")
    args = parser.parse_args()

    try:
        cfg = read_config()
        initialize_mt5(cfg)

        if args.once:
            run_once(cfg)
            return 0

        print("[bridge] Started read-only sync loop")
        while True:
            try:
                run_once(cfg)
            except Exception as loop_err:
                print(f"[bridge] Sync error: {loop_err}")
            time.sleep(cfg.poll_seconds)
    except KeyboardInterrupt:
        print("[bridge] Stopped")
        return 0
    except Exception as err:
        print(f"[bridge] Fatal error: {err}")
        return 1
    finally:
        try:
            mt5.shutdown()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
