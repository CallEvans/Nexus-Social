import os
import re
import random
import string
from datetime import datetime
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, session, jsonify, flash
from flask_socketio import SocketIO, emit, join_room, leave_room
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "nexus-dev-secret-change-this")

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


# ─── Helpers ────────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def get_current_user():
    if "user_id" not in session:
        return None
    res = supabase_admin.table("users").select("*").eq("id", session["user_id"]).single().execute()
    return res.data if res.data else None


def generate_nexus_id():
    """Auto-increment: count users + 1, zero-pad to 6 digits."""
    res = supabase_admin.table("users").select("id", count="exact").execute()
    count = res.count if res.count else 0
    return str(count + 1).zfill(6)


def generate_group_id(name: str) -> str:
    """
    Generate group ID: initials of each capitalised word + total letter count
    + dash + 2 random alphanumeric chars.
    e.g. 'Friends Together' → FT15-X4
    """
    words = [w for w in name.split() if w]
    initials = "".join(w[0].upper() for w in words)
    total_letters = sum(len(re.sub(r'[^a-zA-Z]', '', w)) for w in words)
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=2))
    base = f"{initials}{total_letters}"
    candidate = f"{base}-{suffix}"
    # Ensure uniqueness
    while True:
        exists = supabase_admin.table("groups").select("id").eq("group_code", candidate).execute()
        if not exists.data:
            return candidate
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=2))
        candidate = f"{base}-{suffix}"


# ─── Auth Routes ─────────────────────────────────────────────────────────────

@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("feed"))
    return render_template("landing.html")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        data = request.get_json() or request.form
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        username = data.get("username", "").strip().lower()
        full_name = data.get("full_name", "").strip()
        age = data.get("age", "")
        gender = data.get("gender", "")
        pronouns = data.get("pronouns", "")
        sexuality = data.get("sexuality", "")
        country = data.get("country", "")

        # Validate username uniqueness
        existing = supabase_admin.table("users").select("id").eq("username", username).execute()
        if existing.data:
            return jsonify({"error": "Username already taken"}), 400

        # Create auth user via Supabase Auth
        try:
            auth_res = supabase.auth.sign_up({"email": email, "password": password})
            auth_user = auth_res.user
            if not auth_user:
                return jsonify({"error": "Registration failed"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 400

        nexus_id = generate_nexus_id()

        # Insert into users table
        supabase_admin.table("users").insert({
            "id": auth_user.id,
            "nexus_id": nexus_id,
            "email": email,
            "username": username,
            "full_name": full_name,
            "age": int(age) if age else None,
            "gender": gender,
            "pronouns": pronouns,
            "sexuality": sexuality,
            "country": country,
            "avatar_url": None,
            "bio": "",
            "personal_links": [],
            "is_suspended": False,
            "is_banned": False,
            "suspended_until": None,
        }).execute()

        # Create welcome notification
        supabase_admin.table("notifications").insert({
            "user_id": auth_user.id,
            "type": "welcome",
            "content": f"Welcome to Nexus Social, {full_name}! Your Nexus ID is #{nexus_id} 🎉",
            "read": False,
        }).execute()

        return jsonify({"success": True, "message": "Check your email to confirm your account!"})

    return render_template("auth.html", mode="register")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        data = request.get_json() or request.form
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        try:
            res = supabase.auth.sign_in_with_password({"email": email, "password": password})
            auth_user = res.user
            if not auth_user:
                return jsonify({"error": "Invalid credentials"}), 401
        except Exception as e:
            return jsonify({"error": "Invalid email or password"}), 401

        # Check if banned/suspended
        user = supabase_admin.table("users").select("*").eq("id", auth_user.id).single().execute()
        if not user.data:
            return jsonify({"error": "Account not found"}), 404

        profile = user.data
        if profile.get("is_banned"):
            return jsonify({"error": "Your account has been permanently banned."}), 403

        if profile.get("is_suspended"):
            until = profile.get("suspended_until")
            if until:
                until_dt = datetime.fromisoformat(until.replace("Z", "+00:00"))
                if datetime.now().astimezone() < until_dt:
                    return jsonify({"error": f"Your account is suspended until {until_dt.strftime('%Y-%m-%d %H:%M UTC')}"}), 403
            # Suspension expired — lift it
            supabase_admin.table("users").update({"is_suspended": False, "suspended_until": None}).eq("id", auth_user.id).execute()

        session["user_id"] = auth_user.id
        session["username"] = profile["username"]
        session["nexus_id"] = profile["nexus_id"]
        return jsonify({"success": True})

    return render_template("auth.html", mode="login")


@app.route("/logout")
def logout():
    session.clear()
    supabase.auth.sign_out()
    return redirect(url_for("index"))


# ─── Main App Routes ──────────────────────────────────────────────────────────

@app.route("/feed")
@login_required
def feed():
    user = get_current_user()
    return render_template("app.html", user=user, page="feed")


@app.route("/messages")
@login_required
def messages():
    user = get_current_user()
    return render_template("app.html", user=user, page="messages")


@app.route("/groups")
@login_required
def groups():
    user = get_current_user()
    return render_template("app.html", user=user, page="groups")


@app.route("/notifications")
@login_required
def notifications():
    user = get_current_user()
    return render_template("app.html", user=user, page="notifications")


@app.route("/profile")
@app.route("/profile/<username>")
@login_required
def profile(username=None):
    user = get_current_user()
    if username:
        target = supabase_admin.table("users").select("*").eq("username", username).single().execute()
        profile_user = target.data
    else:
        profile_user = user
    return render_template("app.html", user=user, profile_user=profile_user, page="profile")


# ─── API: Users ───────────────────────────────────────────────────────────────

@app.route("/api/users/search")
@login_required
def search_users():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    # Search by username or group code
    users = supabase_admin.table("users").select(
        "id,nexus_id,username,full_name,avatar_url,country,pronouns"
    ).ilike("username", f"%{q}%").limit(10).execute()

    groups = supabase_admin.table("groups").select(
        "id,group_code,name,member_count,banner_emoji"
    ).ilike("group_code", f"%{q}%").limit(5).execute()

    return jsonify({"users": users.data or [], "groups": groups.data or []})


@app.route("/api/users/profile/<user_id>")
@login_required
def get_profile(user_id):
    res = supabase_admin.table("users").select(
        "id,nexus_id,username,full_name,avatar_url,bio,country,pronouns,sexuality,gender,personal_links,created_at"
    ).eq("id", user_id).single().execute()
    return jsonify(res.data or {})


@app.route("/api/users/update-profile", methods=["POST"])
@login_required
def update_profile():
    data = request.get_json()
    allowed = ["full_name", "username", "bio", "country", "pronouns", "sexuality", "gender", "personal_links", "avatar_url"]
    update_data = {k: v for k, v in data.items() if k in allowed}

    if "username" in update_data:
        existing = supabase_admin.table("users").select("id").eq("username", update_data["username"]).execute()
        if existing.data and existing.data[0]["id"] != session["user_id"]:
            return jsonify({"error": "Username taken"}), 400

    supabase_admin.table("users").update(update_data).eq("id", session["user_id"]).execute()
    if "username" in update_data:
        session["username"] = update_data["username"]
    return jsonify({"success": True})


@app.route("/api/users/delete-account", methods=["DELETE"])
@login_required
def delete_account():
    uid = session["user_id"]
    supabase_admin.auth.admin.delete_user(uid)
    supabase_admin.table("users").delete().eq("id", uid).execute()
    session.clear()
    return jsonify({"success": True})


# ─── API: Friends ─────────────────────────────────────────────────────────────

@app.route("/api/friends/request", methods=["POST"])
@login_required
def send_friend_request():
    data = request.get_json()
    receiver_id = data.get("receiver_id")
    existing = supabase_admin.table("friendships").select("id").eq("sender_id", session["user_id"]).eq("receiver_id", receiver_id).execute()
    if existing.data:
        return jsonify({"error": "Request already sent"}), 400

    supabase_admin.table("friendships").insert({
        "sender_id": session["user_id"],
        "receiver_id": receiver_id,
        "status": "pending"
    }).execute()

    sender = get_current_user()
    supabase_admin.table("notifications").insert({
        "user_id": receiver_id,
        "type": "friend_request",
        "content": f"@{sender['username']} sent you a friend request",
        "meta": {"sender_id": session["user_id"]},
        "read": False,
    }).execute()

    return jsonify({"success": True})


@app.route("/api/friends/respond", methods=["POST"])
@login_required
def respond_friend_request():
    data = request.get_json()
    friendship_id = data.get("friendship_id")
    action = data.get("action")  # "accept" or "decline"

    if action == "accept":
        supabase_admin.table("friendships").update({"status": "accepted"}).eq("id", friendship_id).execute()
    else:
        supabase_admin.table("friendships").delete().eq("id", friendship_id).execute()

    return jsonify({"success": True})


@app.route("/api/friends/list")
@login_required
def get_friends():
    uid = session["user_id"]
    res = supabase_admin.table("friendships").select(
        "id,status,sender_id,receiver_id,users!friendships_sender_id_fkey(id,username,full_name,avatar_url,country),users!friendships_receiver_id_fkey(id,username,full_name,avatar_url,country)"
    ).or_(f"sender_id.eq.{uid},receiver_id.eq.{uid}").eq("status", "accepted").execute()
    return jsonify(res.data or [])


# ─── API: Messages ────────────────────────────────────────────────────────────

@app.route("/api/messages/request", methods=["POST"])
@login_required
def send_message_request():
    data = request.get_json()
    receiver_id = data.get("receiver_id")
    supabase_admin.table("message_requests").insert({
        "sender_id": session["user_id"],
        "receiver_id": receiver_id,
        "status": "pending"
    }).execute()
    return jsonify({"success": True})


@app.route("/api/messages/dm/<other_user_id>")
@login_required
def get_dm(other_user_id):
    uid = session["user_id"]
    res = supabase_admin.table("direct_messages").select(
        "*,sender:users!direct_messages_sender_id_fkey(id,username,full_name,avatar_url)"
    ).or_(
        f"and(sender_id.eq.{uid},receiver_id.eq.{other_user_id}),and(sender_id.eq.{other_user_id},receiver_id.eq.{uid})"
    ).order("created_at").execute()
    # Mark as seen
    supabase_admin.table("direct_messages").update({"seen": True}).eq("receiver_id", uid).eq("sender_id", other_user_id).execute()
    return jsonify(res.data or [])


@app.route("/api/messages/conversations")
@login_required
def get_conversations():
    uid = session["user_id"]
    # Get unique conversation partners
    res = supabase_admin.rpc("get_conversations", {"p_user_id": uid}).execute()
    return jsonify(res.data or [])


# ─── API: Groups ─────────────────────────────────────────────────────────────

@app.route("/api/groups/create", methods=["POST"])
@login_required
def create_group():
    # Check if groups enabled
    setting = supabase_admin.table("platform_settings").select("value").eq("key", "groups_enabled").single().execute()
    if setting.data and setting.data.get("value") == "false":
        return jsonify({"error": "Group creation is currently disabled"}), 403

    # Check user permission
    user = get_current_user()
    if not user.get("can_create_groups", True):
        return jsonify({"error": "You don't have permission to create groups"}), 403

    data = request.get_json()
    name = data.get("name", "").strip()
    description = data.get("description", "")
    banner_emoji = data.get("banner_emoji", "💬")

    group_code = generate_group_id(name)

    group_res = supabase_admin.table("groups").insert({
        "name": name,
        "description": description,
        "group_code": group_code,
        "banner_emoji": banner_emoji,
        "owner_id": session["user_id"],
        "member_count": 1,
    }).execute()

    group_id = group_res.data[0]["id"]

    # Add owner as member
    supabase_admin.table("group_members").insert({
        "group_id": group_id,
        "user_id": session["user_id"],
        "role": "owner",
    }).execute()

    return jsonify({"success": True, "group_code": group_code, "group_id": group_id})


@app.route("/api/groups/join", methods=["POST"])
@login_required
def join_group():
    data = request.get_json()
    group_code = data.get("group_code")
    group = supabase_admin.table("groups").select("*").eq("group_code", group_code).single().execute()
    if not group.data:
        return jsonify({"error": "Group not found"}), 404

    existing = supabase_admin.table("group_members").select("id").eq("group_id", group.data["id"]).eq("user_id", session["user_id"]).execute()
    if existing.data:
        return jsonify({"error": "Already a member"}), 400

    supabase_admin.table("group_members").insert({
        "group_id": group.data["id"],
        "user_id": session["user_id"],
        "role": "member",
    }).execute()

    supabase_admin.table("groups").update({"member_count": group.data["member_count"] + 1}).eq("id", group.data["id"]).execute()
    return jsonify({"success": True})


@app.route("/api/groups/<group_id>/messages")
@login_required
def get_group_messages(group_id):
    res = supabase_admin.table("group_messages").select(
        "*,sender:users!group_messages_sender_id_fkey(id,username,full_name,avatar_url,country)"
    ).eq("group_id", group_id).order("created_at").limit(50).execute()
    return jsonify(res.data or [])


@app.route("/api/groups/<group_id>/members")
@login_required
def get_group_members(group_id):
    res = supabase_admin.table("group_members").select(
        "*,user:users(id,username,full_name,avatar_url,country,pronouns)"
    ).eq("group_id", group_id).execute()
    return jsonify(res.data or [])


@app.route("/api/groups/discover")
@login_required
def discover_groups():
    res = supabase_admin.table("groups").select("*").order("member_count", desc=True).limit(20).execute()
    return jsonify(res.data or [])


# ─── API: Notifications ───────────────────────────────────────────────────────

@app.route("/api/notifications")
@login_required
def get_notifications():
    res = supabase_admin.table("notifications").select("*").eq("user_id", session["user_id"]).order("created_at", desc=True).limit(30).execute()
    return jsonify(res.data or [])


@app.route("/api/notifications/read-all", methods=["POST"])
@login_required
def mark_all_read():
    supabase_admin.table("notifications").update({"read": True}).eq("user_id", session["user_id"]).execute()
    return jsonify({"success": True})


@app.route("/api/notifications/<notif_id>/resolve", methods=["POST"])
@login_required
def resolve_notification(notif_id):
    """Mark a notification as resolved so action buttons disappear."""
    # Verify ownership
    notif = supabase_admin.table("notifications").select("user_id,meta").eq("id", notif_id).single().execute()
    if not notif.data or notif.data["user_id"] != session["user_id"]:
        return jsonify({"error": "Not found"}), 404
    meta = notif.data.get("meta") or {}
    meta["resolved"] = True
    supabase_admin.table("notifications").update({"read": True, "meta": meta}).eq("id", notif_id).execute()
    return jsonify({"success": True})


@app.route("/api/friends/pending")
@login_required
def get_pending_friends():
    """Return pending friend requests received by current user."""
    uid = session["user_id"]
    res = supabase_admin.table("friendships").select("*").eq(
        "receiver_id", uid).eq("status", "pending").execute()
    return jsonify(res.data or [])


# ─── API: Suggestions ─────────────────────────────────────────────────────────

@app.route("/api/suggestions")
@login_required
def get_suggestions():
    """Return people you may know based on shared attributes."""
    uid  = session["user_id"]
    user = get_current_user()
    if not user:
        return jsonify([])

    # Get existing friends/requests to exclude
    sent     = supabase_admin.table("friendships").select("receiver_id").eq("sender_id", uid).execute()
    received = supabase_admin.table("friendships").select("sender_id").eq("receiver_id", uid).execute()
    exclude  = {uid}
    exclude.update(r["receiver_id"] for r in (sent.data or []))
    exclude.update(r["sender_id"]   for r in (received.data or []))

    suggestions = []
    seen_ids    = set()

    def add_suggestion(u, reasons):
        if u["id"] in seen_ids or u["id"] in exclude:
            return
        seen_ids.add(u["id"])
        u["match_reasons"] = reasons
        suggestions.append(u)

    fields = "id,nexus_id,username,full_name,avatar_url,bio,country,pronouns,sexuality,gender"

    # Same country
    if user.get("country"):
        res = supabase_admin.table("users").select(fields).eq(
            "country", user["country"]).neq("id", uid).limit(12).execute()
        for u in (res.data or []):
            add_suggestion(u, ["country"])

    # Same sexuality
    if user.get("sexuality") and user["sexuality"] not in ("Prefer not to say", ""):
        res = supabase_admin.table("users").select(fields).eq(
            "sexuality", user["sexuality"]).neq("id", uid).limit(8).execute()
        for u in (res.data or []):
            add_suggestion(u, ["sexuality"])

    # Same gender
    if user.get("gender"):
        res = supabase_admin.table("users").select(fields).eq(
            "gender", user["gender"]).neq("id", uid).limit(6).execute()
        for u in (res.data or []):
            add_suggestion(u, ["gender"])

    # Fill with recent users if still few results
    if len(suggestions) < 8:
        res = supabase_admin.table("users").select(fields).neq(
            "id", uid).order("created_at", desc=True).limit(20).execute()
        for u in (res.data or []):
            add_suggestion(u, ["new"])

    return jsonify(suggestions[:24])


# ─── API: Posts ───────────────────────────────────────────────────────────────

@app.route("/api/posts/create", methods=["POST"])
@login_required
def create_post():
    data = request.get_json()
    content = data.get("content", "").strip()
    media_url = data.get("media_url")
    if not content and not media_url:
        return jsonify({"error": "Post cannot be empty"}), 400

    res = supabase_admin.table("posts").insert({
        "user_id": session["user_id"],
        "content": content,
        "media_url": media_url,
        "likes_count": 0,
        "comments_count": 0,
    }).execute()
    return jsonify({"success": True, "post": res.data[0]})


@app.route("/api/posts/feed")
@login_required
def get_feed():
    res = supabase_admin.table("posts").select(
        "*,author:users!posts_user_id_fkey(id,username,full_name,avatar_url,country,nexus_id)"
    ).order("created_at", desc=True).limit(20).execute()
    return jsonify(res.data or [])


@app.route("/api/posts/<post_id>/like", methods=["POST"])
@login_required
def like_post(post_id):
    existing = supabase_admin.table("post_likes").select("id").eq("post_id", post_id).eq("user_id", session["user_id"]).execute()
    if existing.data:
        supabase_admin.table("post_likes").delete().eq("post_id", post_id).eq("user_id", session["user_id"]).execute()
        supabase_admin.rpc("decrement_likes", {"post_id": post_id}).execute()
        return jsonify({"liked": False})
    supabase_admin.table("post_likes").insert({"post_id": post_id, "user_id": session["user_id"]}).execute()
    supabase_admin.rpc("increment_likes", {"post_id": post_id}).execute()
    return jsonify({"liked": True})


# ─── API: Reports ─────────────────────────────────────────────────────────────

@app.route("/api/reports/submit", methods=["POST"])
@login_required
def submit_report():
    data = request.get_json()
    supabase_admin.table("reports").insert({
        "reporter_id": session["user_id"],
        "reported_user_id": data.get("reported_user_id"),
        "reported_message_id": data.get("reported_message_id"),
        "type": data.get("type"),
        "message": data.get("message", ""),
        "status": "pending",
    }).execute()
    return jsonify({"success": True})


# ─── API: Media Upload ────────────────────────────────────────────────────────

@app.route("/api/upload", methods=["POST"])
@login_required
def upload_media():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file"}), 400

    if file.content_length and file.content_length > 20 * 1024 * 1024:
        return jsonify({"error": "File exceeds 20MB limit"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    filename = f"{session['user_id']}/{datetime.utcnow().timestamp()}.{ext}"

    file_bytes = file.read()
    if len(file_bytes) > 20 * 1024 * 1024:
        return jsonify({"error": "File exceeds 20MB limit"}), 400

    res = supabase_admin.storage.from_("media").upload(filename, file_bytes, {"content-type": file.content_type})
    url = supabase_admin.storage.from_("media").get_public_url(filename)
    return jsonify({"url": url})


# ─── Socket.IO — Real-time ────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    if "user_id" in session:
        join_room(f"user_{session['user_id']}")
        emit("connected", {"user_id": session["user_id"]})


@socketio.on("join_group")
def on_join_group(data):
    group_id = data.get("group_id")
    join_room(f"group_{group_id}")
    emit("user_joined", {"user_id": session.get("user_id"), "username": session.get("username")}, to=f"group_{group_id}")


@socketio.on("leave_group")
def on_leave_group(data):
    group_id = data.get("group_id")
    leave_room(f"group_{group_id}")


@socketio.on("group_message")
def on_group_message(data):
    group_id = data.get("group_id")
    content = data.get("content", "").strip()
    media_url = data.get("media_url")

    if not content and not media_url:
        return

    uid = session.get("user_id")
    if not uid:
        return

    # Verify membership
    member = supabase_admin.table("group_members").select("id").eq("group_id", group_id).eq("user_id", uid).execute()
    if not member.data:
        return

    msg = supabase_admin.table("group_messages").insert({
        "group_id": group_id,
        "sender_id": uid,
        "content": content,
        "media_url": media_url,
    }).execute()

    user = supabase_admin.table("users").select("id,username,full_name,avatar_url,country").eq("id", uid).single().execute()

    emit("new_group_message", {
        "id": msg.data[0]["id"],
        "group_id": group_id,
        "content": content,
        "media_url": media_url,
        "sender": user.data,
        "created_at": msg.data[0]["created_at"],
    }, to=f"group_{group_id}")


@socketio.on("dm_message")
def on_dm_message(data):
    receiver_id = data.get("receiver_id")
    content = data.get("content", "").strip()
    media_url = data.get("media_url")
    uid = session.get("user_id")

    if not content and not media_url:
        return

    msg = supabase_admin.table("direct_messages").insert({
        "sender_id": uid,
        "receiver_id": receiver_id,
        "content": content,
        "media_url": media_url,
        "seen": False,
    }).execute()

    user = supabase_admin.table("users").select("id,username,full_name,avatar_url,country").eq("id", uid).single().execute()

    payload = {
        "id": msg.data[0]["id"],
        "content": content,
        "media_url": media_url,
        "sender": user.data,
        "receiver_id": receiver_id,
        "created_at": msg.data[0]["created_at"],
    }

    emit("new_dm", payload, to=f"user_{receiver_id}")
    emit("new_dm", payload, to=f"user_{uid}")


@socketio.on("typing")
def on_typing(data):
    target = data.get("target_id")
    is_group = data.get("is_group", False)
    room = f"group_{target}" if is_group else f"user_{target}"
    emit("user_typing", {"user_id": session.get("user_id"), "username": session.get("username")}, to=room, include_self=False)


@socketio.on("disconnect")
def on_disconnect():
    pass


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, debug=False)
