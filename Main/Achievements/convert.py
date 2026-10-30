#!/usr/bin/env python3
"""Skript の実績 YAML を、静的サイト用の data/achievements.json に変換する。

使い方:
    python convert.py 実績.yml                      # data/achievements.json を出力
    python convert.py 実績.yml -o data/achievements.json
    (達成者名は常に公開されます)
    python convert.py 実績.yml --hide-conditions    # 達成条件を隠す
    python convert.py 実績.yml --exclude Test       # Test カテゴリを除外
    (新規追加は NEW、名前・条件・ポイント等の修正は FIXED。記録は history.local.json)
"""
import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import yaml


def as_list(v):
    if v is None:
        return []
    if isinstance(v, list):
        return v
    return [v]


def num_key(n):
    """'1-10' のような番号を数値順に並べるためのキー"""
    return [int(p) if p.isdigit() else 0 for p in re.split(r"[-.]", str(n))]


HISTORY_DEFAULT = Path(__file__).with_name("history.local.json")   # 公開しない (.gitignore 済み)
KEEP_DAYS = 31   # NEW / FIXED の日付をJSONに残す日数 (サイト側の表示は30日)


def load_history(path):
    """前回の変換結果の記録。ファイルがなければ None (= 初回: 既存の実績はNEW扱いにしない)"""
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except (OSError, ValueError):
        print("WARN: history file is broken; treated as first run", file=sys.stderr)
        return None


def fingerprint(item, real_conditions):
    """内容が修正されたか判定するための指紋 (名前・ポイント・条件・説明・称号)"""
    body = json.dumps([item["name"], item["points"], real_conditions, item.get("secretView"),
                       item.get("flavorTexts", []), item.get("prefixes", [])], ensure_ascii=False)
    return hashlib.sha1(body.encode("utf-8")).hexdigest()[:12]


def convert(src, hide_conditions=False, exclude=(), history=HISTORY_DEFAULT):
    with open(src, encoding="utf-8") as f:
        data = yaml.safe_load(f)
    root = data.get("Achievements", data)

    today = datetime.now().astimezone().date()
    prev = load_history(history) if history else None
    baseline = prev is None          # 初回は全実績の記録だけ作る (NEW表示なし)
    new_hist = {}

    names = []      # プレイヤー名の一覧 (各実績は番号で参照 → ファイルが小さくなる)
    index = {}

    def pid(name):
        if name not in index:
            index[name] = len(names)
            names.append(name)
        return index[name]

    categories = []
    for cat_id, cat in root.items():
        if not isinstance(cat, dict):
            continue  # lastProcessedCount など
        if cat_id in exclude:
            continue
        achievements = []
        for key, a in cat.items():
            if not isinstance(a, dict):
                continue  # maxAchievedCount
            if str(a.get("isAchievementItem", True)).lower() == "false":
                continue  # 実績ではないアイテム
            number = str(a.get("achievementNumber", ""))
            if re.split(r"[-.]", number)[0] == "99":
                continue  # 番号が 99- から始まる実績は非公開 (JSONにも出さない)
            players = [str(p) for p in as_list(a.get("achievedPlayers"))]
            msgs = as_list(a.get("messages"))
            creators = as_list(a.get("messageCreators"))
            messages = []
            for i, m in enumerate(msgs):
                messages.append({
                    "text": str(m).replace("%nl%", "\n"),
                    "author": str(creators[i]) if i < len(creators) else "",
                })

            prefixes = []
            pf = a.get("achievementPrefixes") or {}
            for k, pv in pf.items():
                if isinstance(pv, dict):
                    prefixes.append(pv.get("prefixName", ""))

            item = {
                "id": key,
                "number": number,
                "name": str(a.get("itemName", key)),
                "points": a.get("achievementPoint", 0) or 0,
            }
            # 空の項目は出力しない (サイトが空として扱う)
            if prefixes:
                item["prefixes"] = prefixes
            flavor = [str(x) for x in as_list(a.get("flavorTexts"))]
            if flavor:
                item["flavorTexts"] = flavor
            if messages:
                item["messages"] = messages
            # achievementSecretConditions がある実績は、本当の条件を JSON に一切出さず、
            # 秘密用の表示 (例: &4&k???) だけを公開する
            secret = [str(x) for x in as_list(a.get("achievementSecretConditions"))]
            if secret:
                item["secret"] = True
                item["conditions"] = secret
            elif not hide_conditions:
                cond = [str(x) for x in as_list(a.get("achievementConditions"))]
                if cond:
                    item["conditions"] = cond
            if players:
                item["p"] = [pid(n) for n in players]

            # --- NEW / FIXED の判定 ---
            real = [str(x) for x in as_list(a.get("achievementConditions"))]
            fp = fingerprint({"name": item["name"], "points": item["points"], "secretView": secret,
                              "flavorTexts": flavor, "prefixes": prefixes}, real)
            hk = f"{cat_id}/{key}"
            old = (prev or {}).get(hk)
            if old is None:
                e = {"fp": fp, "add": None if baseline else today.isoformat(), "fix": None}
            else:
                e = dict(old)
                if e.get("fp") != fp:
                    e["fp"] = fp
                    e["fix"] = today.isoformat()
            new_hist[hk] = e
            for field in ("add", "fix"):
                try:
                    if e.get(field) and (today - date.fromisoformat(e[field])).days <= KEEP_DAYS:
                        item[field] = e[field]
                except ValueError:
                    pass
            achievements.append(item)

        achievements.sort(key=lambda x: num_key(x["number"]))
        categories.append({"id": cat_id, "achievements": achievements})

    return {
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "players": names,
        "categories": categories,
    }, new_hist


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("-o", "--out", default="data/achievements.json")
    ap.add_argument("--history", default=str(HISTORY_DEFAULT), help="NEW/FIXED判定用の記録ファイル (公開されません)")
    ap.add_argument("--show-players", action="store_true", help=argparse.SUPPRESS)  # 旧オプション(無視される)
    ap.add_argument("--hide-conditions", action="store_true")
    ap.add_argument("--exclude", nargs="*", default=[], help="除外するカテゴリ名 (例: --exclude Test)")
    args = ap.parse_args()

    def fail(msg):
        print("ERROR: " + msg, file=sys.stderr)
        print("公開用データは更新していません (前回の内容のまま)。", file=sys.stderr)
        return 1

    # 失敗したときは出力ファイルにも履歴にも触らない (壊れたデータを公開しない)
    try:
        out, hist = convert(args.src, args.hide_conditions, set(args.exclude), args.history)
    except FileNotFoundError:
        return fail(f"YAMLファイルが見つかりません: {args.src}")
    except yaml.YAMLError as e:
        return fail(f"YAMLの形式エラーです: {e}")
    except (AttributeError, TypeError, ValueError) as e:
        return fail(f"YAMLの内容を読み取れませんでした: {e}")

    n = sum(len(c["achievements"]) for c in out["categories"])
    if n == 0:
        return fail("実績が1件も見つかりませんでした (YAMLが空、または形式が違う可能性があります)")

    tmp = args.out + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, separators=(",", ":"))  # 軽量化のため改行・空白なし
        os.replace(tmp, args.out)
        if args.history:
            with open(args.history, "w", encoding="utf-8") as f:
                json.dump(hist, f, ensure_ascii=False, separators=(",", ":"))
    except OSError as e:
        return fail(f"ファイルを書き込めませんでした: {e}")
    print(f"OK: {len(out['categories'])} categories, {n} achievements -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
