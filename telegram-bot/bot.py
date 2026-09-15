import os
import random
import string
import asyncio
import threading
import json
import base64
import time
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from telegram import Update, BotCommand, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
from flask import Flask

import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

IST = timezone(timedelta(hours=5, minutes=30))

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "0"))

_db = None
_fb_initialized = False


def init_firebase():
    global _db, _fb_initialized
    if _fb_initialized and _db is not None:
        return _db

    if not firebase_admin._apps:
        cred_b64 = os.getenv("FIREBASE_CRED_BASE64")
        if cred_b64:
            try:
                cred_json = json.loads(base64.b64decode(cred_b64))
                cred = credentials.Certificate(cred_json)
                firebase_admin.initialize_app(cred)
                print("Firebase initialized from base64 env var")
            except Exception as e:
                print(f"Firebase base64 init failed: {e}")
                return None
        else:
            cred_path = os.getenv("FIREBASE_CRED_PATH", "serviceAccountKey.json")
            if os.path.exists(cred_path):
                try:
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                    print(f"Firebase initialized with {cred_path}")
                except Exception as e:
                    print(f"Firebase file init failed: {e}")
                    return None
            else:
                print("WARNING: No Firebase credentials found.")
                return None

    try:
        _db = firestore.client()
        _fb_initialized = True
        print("Firestore client created successfully")
        return _db
    except Exception as e:
        print(f"Firestore client creation failed: {e}")
        _fb_initialized = False
        return None


def get_db():
    global _db, _fb_initialized
    if _db is not None:
        return _db
    return init_firebase()


def retry_firebase(max_retries=3, delay=2):
    for attempt in range(max_retries):
        db = init_firebase()
        if db is not None:
            return db
        print(f"Firebase retry {attempt + 1}/{max_retries}...")
        time.sleep(delay)
    return None


for _attempt in range(5):
    _result = init_firebase()
    if _result is not None:
        print(f"Firebase connected on attempt {_attempt + 1}")
        break
    print(f"Firebase init attempt {_attempt + 1} failed, retrying in 3s...")
    time.sleep(3)
else:
    print("WARNING: Firebase failed after 5 attempts. Will retry on first command.")


def generate_key():
    parts = ["".join(random.choices(string.ascii_uppercase + string.digits, k=4)) for _ in range(4)]
    return f"RI-{'-'.join(parts)}"


def clean_args(args):
    return [a.strip("<>[]@") for a in args]


def get_expiry(duration: str):
    now = datetime.now(IST)
    if duration == "1h":
        return now + timedelta(hours=1)
    elif duration == "5h":
        return now + timedelta(hours=5)
    elif duration == "12h":
        return now + timedelta(hours=12)
    elif duration == "1d":
        return now + timedelta(days=1)
    elif duration == "7d":
        return now + timedelta(days=7)
    elif duration == "30d":
        return now + timedelta(days=30)
    return None


DURATION_MAP = {
    "1h": "1 Hour",
    "5h": "5 Hours",
    "12h": "12 Hours",
    "1d": "1 Day",
    "7d": "7 Days",
    "30d": "30 Days",
    "lifetime": "Lifetime",
}


def safe_get_db():
    db = get_db()
    if not db:
        db = retry_firebase()
    return db


def safe_firestore_op(fn, *args, **kwargs):
    db = safe_get_db()
    if not db:
        return None, "db_error"
    try:
        return fn(db, *args, **kwargs), "ok"
    except Exception as e:
        print(f"Firestore error: {e}")
        global _fb_initialized
        _fb_initialized = False
        db = retry_firebase()
        if db:
            try:
                return fn(db, *args, **kwargs), "ok"
            except Exception as e2:
                print(f"Firestore retry error: {e2}")
                return None, "error"
        return None, "error"


# ── Demonic UI Art ────────────────────────────────────────

DEMON_ART = (
    "⠀⠀⠀⠀⠀⠀⠀⣀⣤⣤⣤⣤⣀⠀⠀⠀⠀⠀⠀\n"
    "⠀⠀⠀⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀\n"
    "⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀\n"
    "⠀⠀⠀⢸⣿⣿⣿⣿⡿⠿⠿⣿⣿⣿⣿⡇⠀⠀⠀\n"
    "⠀⠀⠀⠈⠛⠁⠀⠀⠀⠀⠀⠀⠙⠁⠁⠀⠀⠀⠀\n"
)

SKULL = "💀"
DEVIL = "😈"
FIRE = "🔥"
PENTAGRAM = "⛧"
BLOOD = "🩸"
DEMON = "👹"
HORNS = "Supply"
CROSS_INV = "☠"
CHAIN = "⛓"
EYE = "👁"
WRATH = "💢"
BONE = "🦴"

BOX_TOP = "═══════════════════════════"
BOX_MID = "───────────────────────────"


# ── Commands ──────────────────────────────────────────────


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(
            f"{SKULL} **ACCESS DENIED** {SKULL}\n\n"
            f"Your soul is not authorized.\n"
            f"Begone, mortal."
        )
        return

    name = update.effective_user.first_name or "Soul"
    text = (
        f"{DEVIL}═══════════════════════{DEVIL}\n"
        f"    ⛧  **REEL INSIGHTS**  ⛧\n"
        f"       𝐃𝐄𝐌𝐎𝐍 𝐀𝐃𝐌𝐈𝐍\n"
        f"{DEVIL}═══════════════════════{DEVIL}\n\n"
        f"Welcome back, **{name}**.\nThe abyss missed you.\n\n"
        f"⛓ **_key rituals_**\n"
        f"  /generatekey — Forge a new key\n"
        f"  /deactivate — Obliterate a key\n"
        f"  /renew — Resurrect a key\n\n"
        f"👁 **_dark knowledge_**\n"
        f"  /keyinfo — Inspect a soul\n"
        f"  /listkeys — All bound keys\n"
        f"  /stats — Inventory of the damned\n\n"
        f"☠ **_forbidden arts_**\n"
        f"  /setuser — Bind key to vessel\n"
        f"  /fbstatus — Check the portal\n\n"
        f"{PENTAGRAM}═══════════════════════{PENTAGRAM}"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def generate_key_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **THE UNDERWORLD REJECTS YOU.**")
        return

    args = clean_args(context.args)
    if not args:
        keyboard = [
            [
                InlineKeyboardButton("1 Hour", callback_data="gen_1h"),
                InlineKeyboardButton("5 Hours", callback_data="gen_5h"),
                InlineKeyboardButton("12 Hours", callback_data="gen_12h"),
            ],
            [
                InlineKeyboardButton("1 Day", callback_data="gen_1d"),
                InlineKeyboardButton("7 Days", callback_data="gen_7d"),
                InlineKeyboardButton("30 Days", callback_data="gen_30d"),
            ],
            [InlineKeyboardButton("∞ Lifetime", callback_data="gen_lifetime")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            f"{FIRE} **FORGE A NEW KEY** {FIRE}\n\n"
            f"Choose the lifespan of your creation:\n"
            f"{BOX_MID}",
            parse_mode="Markdown",
            reply_markup=reply_markup,
        )
        return

    duration = args[0].lower()
    if duration not in DURATION_MAP:
        await update.message.reply_text(
            f"{BLOOD} **INVALID DURATION**\n\n"
            f"Choose: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`",
            parse_mode="Markdown",
        )
        return

    username = args[1] if len(args) > 1 else "Unassigned"
    await _do_generate(update, context, duration, username)


async def _do_generate(update, context, duration, username="Unassigned"):
    key = generate_key()
    expiry = get_expiry(duration)

    key_data = {
        "key": key,
        "status": "active",
        "duration": duration,
        "createdAt": datetime.now(IST),
        "expiresAt": expiry,
        "activatedAt": None,
        "deviceFingerprint": None,
        "localStorageId": None,
        "deviceInfo": None,
        "assignedTo": username,
    }

    _, status = safe_firestore_op(lambda db: db.collection("keys").add(key_data))

    expiry_str = expiry.strftime("%d %b %Y, %I:%M %p IST") if expiry else "Never"
    text = (
        f"{'⛧'*3}════════════════{'⛧'*3}\n"
        f"  {FIRE} **KEY FORGED** {FIRE}\n"
        f"{'⛧'*3}════════════════{'⛧'*3}\n\n"
        f"{BLOOD} `{key}`\n\n"
        f"⏳ Lifespan: **{DURATION_MAP[duration]}**\n"
        f"💀 Expires: `{expiry_str}`\n"
        f"⛓ Bound to: {username}\n\n"
        f"{'..:: BLOOD SEALED ::..'}\n"
        f"{'⛧'*3}════════════════{'⛧'*3}"
    )

    if status != "ok":
        text = (
            f"{'☠'*3}════════════════{'☠'*3}\n"
            f"  {WRATH} **FORGING FAILED** {WRATH}\n"
            f"{'☠'*3}════════════════{'☠'*3}\n\n"
            f"{BLOOD} `{key}`\n\n"
            f"⏳ Lifespan: **{DURATION_MAP[duration]}**\n"
            f"💀 Expires: `{expiry_str}`\n"
            f"⛓ Bound to: {username}\n\n"
            f"⚠️ The portal is closed.\n"
            f"Use /fbstatus to inspect.\n"
            f"{'☠'*3}════════════════{'☠'*3}"
        )

    await update.message.reply_text(text, parse_mode="Markdown")


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if query.from_user.id != ADMIN_CHAT_ID:
        return

    data = query.data
    if data.startswith("gen_"):
        duration = data.replace("gen_", "")
        if duration not in DURATION_MAP:
            return
        key = generate_key()
        expiry = get_expiry(duration)

        key_data = {
            "key": key,
            "status": "active",
            "duration": duration,
            "createdAt": datetime.now(IST),
            "expiresAt": expiry,
            "activatedAt": None,
            "deviceFingerprint": None,
            "localStorageId": None,
            "deviceInfo": None,
            "assignedTo": "Unassigned",
        }
        safe_firestore_op(lambda db: db.collection("keys").add(key_data))

        expiry_str = expiry.strftime("%d %b %Y, %I:%M %p IST") if expiry else "Never"
        text = (
            f"{'⛧'*3}════════════════{'⛧'*3}\n"
            f"  {FIRE} **KEY FORGED** {FIRE}\n"
            f"{'⛧'*3}════════════════{'⛧'*3}\n\n"
            f"{BLOOD} `{key}`\n\n"
            f"⏳ Lifespan: **{DURATION_MAP[duration]}**\n"
            f"💀 Expires: `{expiry_str}`\n"
            f"⛓ Bound to: Unassigned\n\n"
            f"{'..:: BLOOD SEALED ::..'}\n"
            f"{'⛧'*3}════════════════{'⛧'*3}"
        )
        await query.edit_message_text(text, parse_mode="Markdown")


async def deactivate_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **ACCESS DENIED.**")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text(
            f"Usage: /deactivate `<key>`", parse_mode="Markdown"
        )
        return

    key = args[0].upper()

    def _deactivate(db):
        q = db.collection("keys").where("key", "==", key)
        docs = q.stream()
        found = False
        for doc in docs:
            doc.reference.update({"status": "deactivated"})
            found = True
        return found

    result, status = safe_firestore_op(_deactivate)

    if status == "ok" and result:
        text = (
            f"{'☠'*3}════════════════{'☠'*3}\n"
            f"  {BLOOD} **KEY OBLITERATED** {BLOOD}\n"
            f"{'☠'*3}════════════════{'☠'*3}\n\n"
            f"🔗 `{key}`\n"
            f"Status: **{CROSS_INV} Destroyed {CROSS_INV}**\n\n"
            f"{'..:: ERASED FROM EXISTENCE ::..'}\n"
            f"{'☠'*3}════════════════{'☠'*3}"
        )
    elif status == "ok":
        text = f"{SKULL} Key `{key}` was never forged here."
    else:
        text = f"{WRATH} The portal is closed. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def key_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **DENIED.**")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text(
            "Usage: /keyinfo `<key>`", parse_mode="Markdown"
        )
        return

    key = args[0].upper()

    def _get_info(db):
        q = db.collection("keys").where("key", "==", key)
        for doc in q.stream():
            return doc.to_dict()
        return None

    data, status = safe_firestore_op(_get_info)

    if status == "ok" and data:
        s = data.get("status", "unknown")
        d = data.get("duration", "unknown")
        who = data.get("assignedTo", "Unassigned")
        created = data.get("createdAt")
        expires = data.get("expiresAt")
        activated = data.get("activatedAt")
        device = data.get("deviceInfo")

        status_icon = {
            "active": f"{EYE} **ALIVE**",
            "deactivated": f"{CROSS_INV} **DEAD**",
            "expired": f"{BONE} **DECAYED**",
        }.get(s, "⚪ Unknown")

        created_str = created.strftime("%d %b %Y %H:%M IST") if created else "N/A"
        expires_str = expires.strftime("%d %b %Y %H:%M IST") if expires else "N/A"
        activated_str = activated.strftime("%d %b %Y %H:%M IST") if activated else "Dormant"

        device_str = "No vessel detected"
        if device:
            device_str = (
                f"Vessel: {device.get('platform', 'N/A')}\n"
                f"Realm: {device.get('screen', 'N/A')}\n"
                f"Sigil: {device.get('userAgent', 'N/A')[:55]}..."
            )

        text = (
            f"{'⛧'*3}════════════════{'⛧'*3}\n"
            f"  {EYE} **SOUL INVENTORY** {EYE}\n"
            f"{'⛧'*3}════════════════{'⛧'*3}\n\n"
            f"🔗 `{key}`\n\n"
            f"State: {status_icon}\n"
            f"⏳ Lifespan: **{DURATION_MAP.get(d, d)}**\n"
            f"⛓ Vessel: {who}\n\n"
            f"📅 Forged: `{created_str}`\n"
            f"💀 Expires: `{expires_str}`\n"
            f"🔓 Awakened: `{activated_str}`\n\n"
            f"{DEMON} **Vessel Details:**\n{device_str}\n\n"
            f"{'⛧'*3}════════════════{'⛧'*3}"
        )
    elif status == "ok":
        text = f"{SKULL} Key `{key}` does not exist in the abyss."
    else:
        text = f"{WRATH} Portal closed. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def list_keys(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **DENIED.**")
        return

    def _list(db):
        q = db.collection("keys").where("status", "==", "active")
        return list(q.stream())

    docs, status = safe_firestore_op(_list)

    if status == "ok":
        if not docs:
            await update.message.reply_text(f"{BONE} No souls are bound.")
            return

        lines = [
            f"{'⛧'*3}════════════════{'⛧'*3}",
            f"  {CHAIN} **BOUND SOULS** ({len(docs)})",
            f"{'⛧'*3}════════════════{'⛧'*3}\n",
        ]
        for i, doc in enumerate(docs, 1):
            d = doc.to_dict()
            k = d.get("key", "?")
            dur = d.get("duration", "?")
            who = d.get("assignedTo", "?")
            exp = d.get("expiresAt")
            exp_str = exp.strftime("%d %b") if exp else "∞"
            lines.append(
                f"**{i}.** `{k}`\n"
                f"     ⏱ {DURATION_MAP.get(dur, dur)} | ⛓ {who}\n"
                f"     💀 {exp_str}"
            )
        lines.append(f"\n{'⛧'*3}════════════════{'⛧'*3}")
        text = "\n".join(lines)
    else:
        text = f"{WRATH} Portal closed. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **DENIED.**")
        return

    def _stats(db):
        all_keys = list(db.collection("keys").stream())
        all_logs = list(db.collection("logs").stream())
        active = sum(1 for d in all_keys if d.to_dict().get("status") == "active")
        deactivated = sum(1 for d in all_keys if d.to_dict().get("status") == "deactivated")
        expired = sum(1 for d in all_keys if d.to_dict().get("status") == "expired")
        activations = sum(1 for d in all_logs if d.to_dict().get("action") == "activated")
        return {
            "total": len(all_keys),
            "active": active,
            "deactivated": deactivated,
            "expired": expired,
            "activations": activations,
        }

    data, status = safe_firestore_op(_stats)

    if status == "ok":
        text = (
            f"{'🔥'*3}════════════════{'🔥'*3}\n"
            f"  {DEMON} **DASHBOARD OF THE DAMNED** {DEMON}\n"
            f"{'🔥'*3}════════════════{'🔥'*3}\n\n"
            f"⛓ Total Souls: **{data['total']}**\n\n"
            f"  {EYE} Alive:        **{data['active']}**\n"
            f"  {CROSS_INV} Destroyed:    **{data['deactivated']}**\n"
            f"  {BONE} Decayed:      **{data['expired']}**\n\n"
            f"🔓 Awakenings: **{data['activations']}**\n\n"
            f"{'🔥'*3}════════════════{'🔥'*3}"
        )
    else:
        text = f"{WRATH} Portal closed. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def set_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **DENIED.**")
        return

    args = clean_args(context.args)
    if len(args) < 2:
        await update.message.reply_text(
            "Usage: /setuser `<key>` `@username`", parse_mode="Markdown"
        )
        return

    key = args[0].upper()
    username = args[1]

    def _set_user(db):
        q = db.collection("keys").where("key", "==", key)
        docs = q.stream()
        for doc in docs:
            doc.reference.update({"assignedTo": username})
            return True
        return False

    found, status = safe_firestore_op(_set_user)

    if status == "ok" and found:
        text = (
            f"{'⛓'*3}════════════════{'⛓'*3}\n"
            f"  {CHAIN} **SOUL BOUND** {CHAIN}\n"
            f"{'⛓'*3}════════════════{'⛓'*3}\n\n"
            f"🔗 `{key}`\n"
            f"⛓ Vessel: {username}\n\n"
            f"{'..:: CHAINS LOCKED ::..'}\n"
            f"{'⛓'*3}════════════════{'⛓'*3}"
        )
    elif status == "ok":
        text = f"{SKULL} Key `{key}` was never forged."
    else:
        text = f"{WRATH} Portal closed. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def renew_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **DENIED.**")
        return

    args = clean_args(context.args)
    if len(args) < 2:
        await update.message.reply_text(
            "Usage: /renew `<key>` `<duration>`", parse_mode="Markdown"
        )
        return

    key = args[0].upper()
    duration = args[1].lower()

    if duration not in DURATION_MAP:
        await update.message.reply_text(
            f"{BLOOD} Invalid duration.\nUse: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`",
            parse_mode="Markdown",
        )
        return

    expiry = get_expiry(duration)

    def _renew(db):
        q = db.collection("keys").where("key", "==", key)
        docs = q.stream()
        for doc in docs:
            update_data = {"duration": duration, "status": "active"}
            if expiry:
                update_data["expiresAt"] = expiry
            doc.reference.update(update_data)
            return True
        return False

    found, status = safe_firestore_op(_renew)

    if status == "ok" and found:
        exp_str = expiry.strftime("%d %b %Y %H:%M IST") if expiry else "Eternal"
        text = (
            f"{'🔥'*3}════════════════{'🔥'*3}\n"
            f"  {FIRE} **SOUL RESURRECTED** {FIRE}\n"
            f"{'🔥'*3}════════════════{'🔥'*3}\n\n"
            f"🔗 `{key}`\n"
            f"⏳ New Lifespan: **{DURATION_MAP[duration]}**\n"
            f"💀 Expires: `{exp_str}`\n\n"
            f"{'..:: REBORN IN FLAMES ::..'}\n"
            f"{'🔥'*3}════════════════{'🔥'*3}"
        )
    elif status == "ok":
        text = f"{SKULL} Key `{key}` does not exist."
    else:
        text = f"{WRATH} Portal closed. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def fb_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(f"{SKULL} **DENIED.**")
        return

    cred_b64 = os.getenv("FIREBASE_CRED_BASE64")
    cred_path = os.getenv("FIREBASE_CRED_PATH")
    db = safe_get_db()

    lines = [
        f"{'⛓'*3}════════════════{'⛓'*3}",
        f"  {EYE} **PORTAL STATUS** {EYE}",
        f"{'⛓'*3}════════════════{'⛓'*3}\n",
        f"📦 Core: **{'{OK}' if firebase_admin._apps else '{FAIL}'}**",
        f"🔐 CRED_BASE64: **{'{SET}' if cred_b64 else '{MISSING}'}**",
        f"📄 CRED_PATH: **{cred_path or '{MISSING}'}**",
        f"🗄 Portal: **{'{OPEN}' if db else '{SEALED}'}**\n",
    ]

    if db:
        try:
            list(db.collection("keys").limit(1).stream())
            lines.append("✅ Read/Write: **{PERMITTED}**")
        except Exception as e:
            lines.append(f"❌ Read/Write: **{{BLOCKED}}**\n`{str(e)[:55]}`")
            global _fb_initialized
            _fb_initialized = False
            db = init_firebase()
            lines.append(f"🔄 Reconnect: **{'{OPEN}' if db else '{FAILED}'}**")
    else:
        lines.append("🔄 Attempting to reopen portal...")
        db = retry_firebase()
        lines.append(f"🔄 Reconnect: **{'{OPEN}' if db else '{FAILED}'}**")
        if not db:
            lines.append(f"\n{WRATH} Check `FIREBASE_CRED_BASE64` in Render env vars.")

    lines.append(f"\n{'⛓'*3}════════════════{'⛓'*3}")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id == ADMIN_CHAT_ID:
        await update.message.reply_text(
            f"{DEVIL} Unknown incantation.\nUse /start for the grimoire."
        )
    else:
        await update.message.reply_text(
            f"{SKULL} **YOUR SOUL IS NOT WELCOME HERE.**"
        )


async def post_init(application: Application):
    await application.bot.set_my_commands([
        BotCommand("start", "Open the grimoire"),
        BotCommand("generatekey", "Forge a new key"),
        BotCommand("deactivate", "Obliterate a key"),
        BotCommand("keyinfo", "Inspect a soul"),
        BotCommand("listkeys", "List bound souls"),
        BotCommand("stats", "Dashboard of the damned"),
        BotCommand("setuser", "Bind key to vessel"),
        BotCommand("renew", "Resurrect a key"),
        BotCommand("fbstatus", "Check the portal"),
    ])


def run_bot():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("generatekey", generate_key_cmd))
    app.add_handler(CommandHandler("deactivate", deactivate_key))
    app.add_handler(CommandHandler("keyinfo", key_info))
    app.add_handler(CommandHandler("listkeys", list_keys))
    app.add_handler(CommandHandler("stats", stats))
    app.add_handler(CommandHandler("setuser", set_user))
    app.add_handler(CommandHandler("renew", renew_key))
    app.add_handler(CommandHandler("fbstatus", fb_status))
    app.add_handler(CallbackQueryHandler(callback_handler, pattern="^gen_"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Bot is running!")
    app.run_polling(drop_pending_updates=True)


def main():
    print("Starting Reel Insights Admin Bot...")

    flask_app = Flask(__name__)

    @flask_app.route("/")
    def health():
        return "Bot is running!"

    @flask_app.route("/health")
    def health_check():
        return {"status": "ok"}

    def run_flask():
        port = int(os.getenv("PORT", 8080))
        flask_app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)

    flask_thread = threading.Thread(target=run_flask, daemon=True)
    flask_thread.start()
    print(f"Health server started on port {os.getenv('PORT', 8080)}")

    run_bot()


if __name__ == "__main__":
    main()
