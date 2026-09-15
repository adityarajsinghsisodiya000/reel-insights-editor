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
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
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


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied. Admin only.")
        return

    help_text = (
        "**Reel Insights Admin Bot**\n\n"
        "**Commands:**\n"
        "/generatekey `<duration>` - Generate a new key\n"
        "  Duration: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`\n"
        "  Example: `/generatekey 7d`\n\n"
        "/deactivate `<key>` - Deactivate a key\n"
        "/keyinfo `<key>` - Get key details\n"
        "/listkeys - List all active keys\n"
        "/stats - Show statistics\n"
        "/setuser `<key>` `@username` - Assign key to user\n"
        "/renew `<key>` `<duration>` - Renew/extend key\n"
        "/fbstatus - Check Firebase connection\n\n"
        "**Key Format:** `RI-XXXX-XXXX-XXXX`"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def generate_key_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text("Usage: /generatekey `<duration>`\nDuration: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`", parse_mode="Markdown")
        return

    duration = args[0].lower()
    if duration not in DURATION_MAP:
        await update.message.reply_text(f"Invalid duration. Use: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`", parse_mode="Markdown")
        return

    username = args[1] if len(args) > 1 else "Unassigned"
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

    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            db.collection("keys").add(key_data)
        except Exception as e:
            print(f"Firestore write error: {e}")
            db = None
            _fb_initialized = False
            db = retry_firebase()
            if db:
                try:
                    db.collection("keys").add(key_data)
                except Exception as e2:
                    print(f"Firestore retry write error: {e2}")
                    await update.message.reply_text("Database error. Try again.")
                    return
            else:
                await update.message.reply_text("Database error. Try again.")
                return

    expiry_str = expiry.strftime("%d %b %Y, %I:%M %p UTC") if expiry else "Never"
    response = (
        f"**Key Generated**\n\n"
        f"`{key}`\n\n"
        f"Duration: **{DURATION_MAP[duration]}**\n"
        f"Expires: `{expiry_str}`\n"
        f"Assigned to: {username}\n\n"
        f"Send this key to the user."
    )
    await update.message.reply_text(response, parse_mode="Markdown")


async def deactivate_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text("Usage: /deactivate `<key>`", parse_mode="Markdown")
        return

    key = args[0].upper()
    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            keys_ref = db.collection("keys")
            query = keys_ref.where("key", "==", key)
            docs = query.stream()
            found = False
            for doc in docs:
                doc.reference.update({"status": "deactivated"})
                found = True
            if found:
                await update.message.reply_text(f"Key `{key}` deactivated.", parse_mode="Markdown")
            else:
                await update.message.reply_text(f"Key `{key}` not found.", parse_mode="Markdown")
            return
        except Exception as e:
            print(f"Firestore error: {e}")
            _fb_initialized = False

    await update.message.reply_text("Database error. Try /fbstatus.")


async def key_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = clean_args(context.args)
    if not args:
        await update.message.reply_text("Usage: /keyinfo `<key>`", parse_mode="Markdown")
        return

    key = args[0].upper()
    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            keys_ref = db.collection("keys")
            query = keys_ref.where("key", "==", key)
            docs = query.stream()
            for doc in docs:
                data = doc.to_dict()
                status = data.get("status", "unknown")
                duration = data.get("duration", "unknown")
                assigned = data.get("assignedTo", "Unassigned")
                created = data.get("createdAt")
                expires = data.get("expiresAt")
                activated = data.get("activatedAt")
                device = data.get("deviceInfo")

                created_str = created.strftime("%d %b %Y %H:%M UTC") if created else "N/A"
                expires_str = expires.strftime("%d %b %Y %H:%M UTC") if expires else "N/A"
                activated_str = activated.strftime("%d %b %Y %H:%M UTC") if activated else "Not activated"

                device_str = "No device info"
                if device:
                    device_str = (
                        f"Platform: {device.get('platform', 'N/A')}\n"
                        f"Screen: {device.get('screen', 'N/A')}\n"
                        f"UA: {device.get('userAgent', 'N/A')[:80]}..."
                    )

                response = (
                    f"**Key Info: `{key}`**\n\n"
                    f"Status: **{status}**\n"
                    f"Duration: **{DURATION_MAP.get(duration, duration)}**\n"
                    f"Assigned to: {assigned}\n"
                    f"Created: `{created_str}`\n"
                    f"Expires: `{expires_str}`\n"
                    f"Activated: `{activated_str}`\n\n"
                    f"**Device Info:**\n{device_str}"
                )
                await update.message.reply_text(response, parse_mode="Markdown")
                return
            await update.message.reply_text(f"Key `{key}` not found.", parse_mode="Markdown")
            return
        except Exception as e:
            print(f"Firestore error: {e}")
            _fb_initialized = False

    await update.message.reply_text("Database error. Try /fbstatus.")


async def list_keys(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            keys_ref = db.collection("keys")
            query = keys_ref.where("status", "==", "active")
            docs = list(query.stream())

            if not docs:
                await update.message.reply_text("No active keys found.")
                return

            lines = ["**Active Keys:**\n"]
            for i, doc in enumerate(docs, 1):
                data = doc.to_dict()
                key = data.get("key", "?")
                duration = data.get("duration", "?")
                assigned = data.get("assignedTo", "?")
                expires = data.get("expiresAt")
                expires_str = expires.strftime("%d %b") if expires else "N/A"
                lines.append(f"{i}. `{key}` | {DURATION_MAP.get(duration, duration)} | {assigned} | exp: {expires_str}")

            await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
            return
        except Exception as e:
            print(f"Firestore error: {e}")
            _fb_initialized = False

    await update.message.reply_text("Database error. Try /fbstatus.")


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            keys_ref = db.collection("keys")
            all_keys = list(keys_ref.stream())
            active = sum(1 for d in all_keys if d.to_dict().get("status") == "active")
            deactivated = sum(1 for d in all_keys if d.to_dict().get("status") == "deactivated")
            expired = sum(1 for d in all_keys if d.to_dict().get("status") == "expired")

            logs_ref = db.collection("logs")
            all_logs = list(logs_ref.stream())
            activations = sum(1 for d in all_logs if d.to_dict().get("action") == "activated")

            response = (
                f"**Statistics**\n\n"
                f"Total Keys: **{len(all_keys)}**\n"
                f"Active: **{active}**\n"
                f"Deactivated: **{deactivated}**\n"
                f"Expired: **{expired}**\n"
                f"Total Activations: **{activations}**"
            )
            await update.message.reply_text(response, parse_mode="Markdown")
            return
        except Exception as e:
            print(f"Firestore error: {e}")
            _fb_initialized = False

    await update.message.reply_text("Database error. Try /fbstatus.")


async def set_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = clean_args(context.args)
    if len(args) < 2:
        await update.message.reply_text("Usage: /setuser `<key>` `@username`", parse_mode="Markdown")
        return

    key = args[0].upper()
    username = args[1]

    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            query = db.collection("keys").where("key", "==", key)
            docs = query.stream()
            for doc in docs:
                doc.reference.update({"assignedTo": username})
                await update.message.reply_text(f"Key `{key}` assigned to {username}.", parse_mode="Markdown")
                return
            await update.message.reply_text(f"Key `{key}` not found.", parse_mode="Markdown")
            return
        except Exception as e:
            print(f"Firestore error: {e}")
            _fb_initialized = False

    await update.message.reply_text("Database error. Try /fbstatus.")


async def renew_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = clean_args(context.args)
    if len(args) < 2:
        await update.message.reply_text("Usage: /renew `<key>` `<duration>`", parse_mode="Markdown")
        return

    key = args[0].upper()
    duration = args[1].lower()

    if duration not in DURATION_MAP:
        await update.message.reply_text(f"Invalid duration. Use: `1h`, `5h`, `12h`, `1d`, `7d`, `30d`, `lifetime`", parse_mode="Markdown")
        return

    expiry = get_expiry(duration)

    db = get_db()
    if not db:
        db = retry_firebase()
    if db:
        try:
            query = db.collection("keys").where("key", "==", key)
            docs = query.stream()
            for doc in docs:
                update_data = {"duration": duration, "status": "active"}
                if expiry:
                    update_data["expiresAt"] = expiry
                doc.reference.update(update_data)
                await update.message.reply_text(
                    f"Key `{key}` renewed for **{DURATION_MAP[duration]}**.\n"
                    f"Expires: `{expiry.strftime('%d %b %Y %H:%M UTC') if expiry else 'Never'}`",
                    parse_mode="Markdown",
                )
                return
            await update.message.reply_text(f"Key `{key}` not found.", parse_mode="Markdown")
            return
        except Exception as e:
            print(f"Firestore error: {e}")
            _fb_initialized = False

    await update.message.reply_text("Database error. Try /fbstatus.")


async def fb_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    db = get_db()
    if not db:
        db = retry_firebase()

    cred_b64 = os.getenv("FIREBASE_CRED_BASE64")
    cred_path = os.getenv("FIREBASE_CRED_PATH")

    status_lines = [
        "**Firebase Status:**\n",
        f"Apps initialized: **{bool(firebase_admin._apps)}**",
        f"CRED_BASE64 env: **{'set' if cred_b64 else 'NOT set'}**",
        f"CRED_PATH env: **{cred_path or 'NOT set'}**",
        f"Firestore client: **{'connected' if db else 'disconnected'}**",
    ]

    if db:
        try:
            test = db.collection("keys").limit(1).stream()
            list(test)
            status_lines.append("Firestore read/write: **OK**")
        except Exception as e:
            status_lines.append(f"Firestore test failed: `{str(e)[:80]}`")
            status_lines.append("\nAttempting reconnect...")
            global _fb_initialized
            _fb_initialized = False
            _db_new = None
            db = init_firebase()
            if db:
                status_lines.append("Reconnect: **SUCCESS**")
            else:
                status_lines.append("Reconnect: **FAILED**")
    else:
        status_lines.append("\nAttempting reconnect...")
        db = retry_firebase()
        if db:
            status_lines.append("Reconnect: **SUCCESS**")
        else:
            status_lines.append("Reconnect: **FAILED**")
            status_lines.append("\nCheck Render env vars:\n`FIREBASE_CRED_BASE64` must be set.")

    await update.message.reply_text("\n".join(status_lines), parse_mode="Markdown")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id == ADMIN_CHAT_ID:
        await update.message.reply_text("Unknown command. Use /start for help.")
    else:
        await update.message.reply_text("This is a private admin bot.")


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
