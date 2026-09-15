import os
import random
import string
import asyncio
import threading
import json
import base64
import time
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Update, BotCommand, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes
from flask import Flask

import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

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
    now = datetime.utcnow()
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

DURATION_EMOJI = {
    "1h": "1",
    "5h": "5",
    "12h": "12",
    "1d": "1",
    "7d": "7",
    "30d": "30",
    "lifetime": "∞",
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


# ── Commands ──────────────────────────────────────────────


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text(
            "⛔ **Access Denied**\n\nThis is a private admin bot."
        )
        return

    name = update.effective_user.first_name or "Admin"
    text = (
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"  🎬 **Reel Insights Admin**\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Welcome back, **{name}**!\n\n"
        f"🔑 **Key Management**\n"
        f"  /generatekey — Generate new key\n"
        f"  /deactivate — Disable a key\n"
        f"  /renew — Extend key duration\n\n"
        f"📊 **Info & Stats**\n"
        f"  /keyinfo — Key details\n"
        f"  /listkeys — All active keys\n"
        f"  /stats — Dashboard stats\n\n"
        f"⚙️ **Utilities**\n"
        f"  /setuser — Assign key to user\n"
        f"  /fbstatus — Connection health\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def generate_key_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
        return

    args = clean_args(context.args)
    if not args:
        keyboard = [
            [
                InlineKeyboardButton("1h", callback_data="gen_1h"),
                InlineKeyboardButton("5h", callback_data="gen_5h"),
                InlineKeyboardButton("12h", callback_data="gen_12h"),
            ],
            [
                InlineKeyboardButton("1d", callback_data="gen_1d"),
                InlineKeyboardButton("7d", callback_data="gen_7d"),
                InlineKeyboardButton("30d", callback_data="gen_30d"),
            ],
            [InlineKeyboardButton("Lifetime", callback_data="gen_lifetime")],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            "🔑 **Generate Key**\n\nSelect duration:",
            parse_mode="Markdown",
            reply_markup=reply_markup,
        )
        return

    duration = args[0].lower()
    if duration not in DURATION_MAP:
        await update.message.reply_text(
            "❌ Invalid duration.\n\nUse: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`",
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
        "createdAt": datetime.utcnow(),
        "expiresAt": expiry,
        "activatedAt": None,
        "deviceFingerprint": None,
        "localStorageId": None,
        "deviceInfo": None,
        "assignedTo": username,
    }

    _, status = safe_firestore_op(lambda db: db.collection("keys").add(key_data))

    expiry_str = expiry.strftime("%d %b %Y, %I:%M %p UTC") if expiry else "Never"
    text = (
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"  ✅ **Key Generated**\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"🔑 `{key}`\n\n"
        f"⏱ Duration: **{DURATION_MAP[duration]}**\n"
        f"📅 Expires: `{expiry_str}`\n"
        f"👤 Assigned: {username}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"Send this key to the user."
    )

    if status != "ok":
        text = (
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  ⚠️ **Key Generated (No DB)**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 `{key}`\n\n"
            f"⏱ Duration: **{DURATION_MAP[duration]}**\n"
            f"📅 Expires: `{expiry_str}`\n"
            f"👤 Assigned: {username}\n\n"
            f"⚠️ Could not save to database.\n"
            f"Use /fbstatus to check."
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
            "createdAt": datetime.utcnow(),
            "expiresAt": expiry,
            "activatedAt": None,
            "deviceFingerprint": None,
            "localStorageId": None,
            "deviceInfo": None,
            "assignedTo": "Unassigned",
        }
        safe_firestore_op(lambda db: db.collection("keys").add(key_data))

        expiry_str = expiry.strftime("%d %b %Y, %I:%M %p UTC") if expiry else "Never"
        text = (
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  ✅ **Key Generated**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 `{key}`\n\n"
            f"⏱ Duration: **{DURATION_MAP[duration]}**\n"
            f"📅 Expires: `{expiry_str}`\n"
            f"👤 Assigned: Unassigned\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"Send this key to the user."
        )
        await query.edit_message_text(text, parse_mode="Markdown")


async def deactivate_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text(
            "Usage: /deactivate `<key>`", parse_mode="Markdown"
        )
        return

    key = args[0].upper()

    def _deactivate(db):
        keys_ref = db.collection("keys")
        q = keys_ref.where("key", "==", key)
        docs = q.stream()
        found = False
        for doc in docs:
            doc.reference.update({"status": "deactivated"})
            found = True
        return found

    result, status = safe_firestore_op(_deactivate)

    if status == "ok" and result:
        text = (
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  🚫 **Key Deactivated**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 `{key}`\n"
            f"Status: **Deactivated**"
        )
    elif status == "ok" and not result:
        text = f"❌ Key `{key}` not found."
    else:
        text = "⚠️ Database error. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def key_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text("Usage: /keyinfo `<key>`", parse_mode="Markdown")
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

        status_icon = {"active": "🟢", "deactivated": "🔴", "expired": "🟡"}.get(s, "⚪")

        created_str = created.strftime("%d %b %Y %H:%M UTC") if created else "N/A"
        expires_str = expires.strftime("%d %b %Y %H:%M UTC") if expires else "N/A"
        activated_str = activated.strftime("%d %b %Y %H:%M UTC") if activated else "Not yet"

        device_str = "No device info"
        if device:
            device_str = (
                f"Platform: {device.get('platform', 'N/A')}\n"
                f"Screen: {device.get('screen', 'N/A')}\n"
                f"UA: {device.get('userAgent', 'N/A')[:60]}..."
            )

        text = (
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  📋 **Key Details**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 `{key}`\n\n"
            f"Status: {status_icon} **{s}**\n"
            f"Duration: ⏱ **{DURATION_MAP.get(d, d)}**\n"
            f"Assigned: 👤 {who}\n\n"
            f"📅 Created: `{created_str}`\n"
            f"⏰ Expires: `{expires_str}`\n"
            f"🔓 Activated: `{activated_str}`\n\n"
            f"📱 **Device Info:**\n{device_str}\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━"
        )
    elif status == "ok":
        text = f"❌ Key `{key}` not found."
    else:
        text = "⚠️ Database error. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def list_keys(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
        return

    def _list(db):
        q = db.collection("keys").where("status", "==", "active")
        return list(q.stream())

    docs, status = safe_firestore_op(_list)

    if status == "ok":
        if not docs:
            await update.message.reply_text("📭 No active keys.")
            return

        lines = [
            f"━━━━━━━━━━━━━━━━━━━━━━",
            f"  🔑 **Active Keys** ({len(docs)})",
            f"━━━━━━━━━━━━━━━━━━━━━━\n",
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
                f"     ⏱ {DURATION_MAP.get(dur, dur)} | 👤 {who}\n"
                f"     📅 {exp_str}"
            )
        lines.append(f"\n━━━━━━━━━━━━━━━━━━━━━━")
        text = "\n".join(lines)
    else:
        text = "⚠️ Database error. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
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
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  📊 **Dashboard**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 Total Keys: **{data['total']}**\n\n"
            f"  🟢 Active:      **{data['active']}**\n"
            f"  🔴 Deactivated: **{data['deactivated']}**\n"
            f"  🟡 Expired:     **{data['expired']}**\n\n"
            f"🔓 Activations: **{data['activations']}**\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━"
        )
    else:
        text = "⚠️ Database error. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def set_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
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
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  👤 **User Assigned**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 `{key}`\n"
            f"👤 → {username}"
        )
    elif status == "ok":
        text = f"❌ Key `{key}` not found."
    else:
        text = "⚠️ Database error. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def renew_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
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
            "❌ Invalid duration.\nUse: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`",
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
        exp_str = expiry.strftime("%d %b %Y %H:%M UTC") if expiry else "Never"
        text = (
            f"━━━━━━━━━━━━━━━━━━━━━━\n"
            f"  🔄 **Key Renewed**\n"
            f"━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"🔑 `{key}`\n"
            f"⏱ Duration: **{DURATION_MAP[duration]}**\n"
            f"📅 Expires: `{exp_str}`"
        )
    elif status == "ok":
        text = f"❌ Key `{key}` not found."
    else:
        text = "⚠️ Database error. Use /fbstatus."

    await update.message.reply_text(text, parse_mode="Markdown")


async def fb_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("⛔ Access denied.")
        return

    cred_b64 = os.getenv("FIREBASE_CRED_BASE64")
    cred_path = os.getenv("FIREBASE_CRED_PATH")

    db = safe_get_db()

    lines = [
        f"━━━━━━━━━━━━━━━━━━━━━━",
        f"  🔧 **Firebase Status**",
        f"━━━━━━━━━━━━━━━━━━━━━━\n",
        f"📦 Apps: **{'OK' if firebase_admin._apps else 'FAIL'}**",
        f"🔐 CRED_BASE64: **{'set' if cred_b64 else 'missing'}**",
        f"📄 CRED_PATH: **{cred_path or 'missing'}**",
        f"🗄 Client: **{'connected' if db else 'disconnected'}**\n",
    ]

    if db:
        try:
            list(db.collection("keys").limit(1).stream())
            lines.append("✅ Read/Write: **OK**")
        except Exception as e:
            lines.append(f"❌ Read/Write: **FAIL**\n`{str(e)[:60]}`")
            global _fb_initialized
            _fb_initialized = False
            db = init_firebase()
            lines.append(f"🔄 Reconnect: **{'OK' if db else 'FAIL'}**")
    else:
        lines.append("🔄 Reconnecting...")
        db = retry_firebase()
        lines.append(f"🔄 Reconnect: **{'OK' if db else 'FAIL'}**")
        if not db:
            lines.append("\n⚠️ Check `FIREBASE_CRED_BASE64` in Render env vars.")

    lines.append(f"\n━━━━━━━━━━━━━━━━━━━━━━")
    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id == ADMIN_CHAT_ID:
        await update.message.reply_text("🤔 Unknown command.\nUse /start for help.")
    else:
        await update.message.reply_text("⛔ This is a private admin bot.")


async def post_init(application: Application):
    await application.bot.set_my_commands([
        BotCommand("start", "Show help"),
        BotCommand("generatekey", "Generate a new key"),
        BotCommand("deactivate", "Deactivate a key"),
        BotCommand("keyinfo", "Get key details"),
        BotCommand("listkeys", "List all active keys"),
        BotCommand("stats", "Show statistics"),
        BotCommand("setuser", "Assign key to user"),
        BotCommand("renew", "Renew/extend key"),
        BotCommand("fbstatus", "Check Firebase connection"),
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
