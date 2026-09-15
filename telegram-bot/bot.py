import os
import random
import string
import asyncio
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Update, BotCommand
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "0"))

if not firebase_admin._apps:
    cred_path = os.getenv("FIREBASE_CRED_PATH", "serviceAccountKey.json")
    if os.path.exists(cred_path):
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    else:
        print(f"WARNING: {cred_path} not found. Running without Firebase.")

db = firestore.client() if firebase_admin._apps else None


def generate_key():
    parts = ["".join(random.choices(string.ascii_uppercase + string.digits, k=4)) for _ in range(4)]
    return f"RI-{'-'.join(parts)}"


def get_expiry(duration: str):
    now = datetime.utcnow()
    if duration == "1d":
        return now + timedelta(days=1)
    elif duration == "7d":
        return now + timedelta(days=7)
    elif duration == "30d":
        return now + timedelta(days=30)
    return None


DURATION_MAP = {
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
        "/generatekey `<duration>` `[@username]` - Generate a new key\n"
        "  Duration: `1d`, `7d`, `30d`, `lifetime`\n"
        "  Example: `/generatekey 7d @username`\n\n"
        "/deactivate `<key>` - Deactivate a key\n"
        "/keyinfo `<key>` - Get key details\n"
        "/listkeys - List all active keys\n"
        "/stats - Show statistics\n"
        "/setuser `<key>` `@username` - Assign key to user\n"
        "/renew `<key>` `<duration>` - Renew/extend key\n\n"
        "**Key Format:** `RI-XXXX-XXXX-XXXX`"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def generate_key_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = context.args
    if not args:
        await update.message.reply_text("Usage: /generatekey `<duration>` `[@username]`", parse_mode="Markdown")
        return

    duration = args[0].lower()
    if duration not in DURATION_MAP:
        await update.message.reply_text(f"Invalid duration. Use: `1d`, `7d`, `30d`, `lifetime`", parse_mode="Markdown")
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

    if db:
        db.collection("keys").add(key_data)

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

    args = context.args
    if not args:
        await update.message.reply_text("Usage: /deactivate `<key>`", parse_mode="Markdown")
        return

    key = args[0].upper()
    if db:
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
    else:
        await update.message.reply_text("Firebase not connected.")


async def key_info(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = context.args
    if not args:
        await update.message.reply_text("Usage: /keyinfo `<key>`", parse_mode="Markdown")
        return

    key = args[0].upper()
    if db:
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
    else:
        await update.message.reply_text("Firebase not connected.")


async def list_keys(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    if db:
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
    else:
        await update.message.reply_text("Firebase not connected.")


async def stats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    if db:
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
    else:
        await update.message.reply_text("Firebase not connected.")


async def set_user(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Usage: /setuser `<key>` `@username`", parse_mode="Markdown")
        return

    key = args[0].upper()
    username = args[1]

    if db:
        query = db.collection("keys").where("key", "==", key)
        docs = query.stream()
        for doc in docs:
            doc.reference.update({"assignedTo": username})
            await update.message.reply_text(f"Key `{key}` assigned to {username}.", parse_mode="Markdown")
            return
        await update.message.reply_text(f"Key `{key}` not found.", parse_mode="Markdown")
    else:
        await update.message.reply_text("Firebase not connected.")


async def renew_key(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if update.effective_user.id != ADMIN_CHAT_ID:
        await update.message.reply_text("Access denied.")
        return

    args = context.args
    if len(args) < 2:
        await update.message.reply_text("Usage: /renew `<key>` `<duration>`", parse_mode="Markdown")
        return

    key = args[0].upper()
    duration = args[1].lower()

    if duration not in DURATION_MAP:
        await update.message.reply_text(f"Invalid duration. Use: `1d`, `7d`, `30d`, `lifetime`", parse_mode="Markdown")
        return

    expiry = get_expiry(duration)

    if db:
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
    else:
        await update.message.reply_text("Firebase not connected.")


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
    ])


def main():
    print("Starting Reel Insights Admin Bot...")
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("generatekey", generate_key_cmd))
    app.add_handler(CommandHandler("deactivate", deactivate_key))
    app.add_handler(CommandHandler("keyinfo", key_info))
    app.add_handler(CommandHandler("listkeys", list_keys))
    app.add_handler(CommandHandler("stats", stats))
    app.add_handler(CommandHandler("setuser", set_user))
    app.add_handler(CommandHandler("renew", renew_key))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Bot is running! Press Ctrl+C to stop.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
