"""
Email service using SMTP (aiosmtplib).

Configure via environment variables:
  SMTP_HOST     — default smtp.gmail.com
  SMTP_PORT     — default 587
  SMTP_USER     — your Gmail or SMTP username
  SMTP_PASSWORD — app password or SMTP password
  EMAIL_FROM    — display address, e.g. "Brandora AI <noreply@brandoraai.com>"

When SMTP_USER is blank the service silently skips sending (dev mode).
"""
import asyncio
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import structlog

from app.core.config import settings

logger = structlog.get_logger(__name__)


async def send_email(
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
) -> bool:
    """Send an email. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info("Email not configured — skipping send", to=to, subject=subject)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM or settings.SMTP_USER
    msg["To"] = to

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        import aiosmtplib
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=True,
        )
        logger.info("Email sent", to=to, subject=subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email", to=to, subject=subject, error=str(exc))
        return False


def _base_template(title: str, content: str) -> str:
    """Minimal branded HTML email template."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);padding:28px 40px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#fff2;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;font-size:20px;">✨</td>
                <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:700;">Brandora AI</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#111827;">{title}</h1>
            {content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; 2025 Brandora AI &nbsp;·&nbsp;
              <a href="{settings.FRONTEND_URL}/privacy" style="color:#7c3aed;text-decoration:none;">Privacy Policy</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


async def send_password_reset_email(to: str, reset_token: str, full_name: str = "") -> bool:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    greeting = f"Hi {full_name}," if full_name else "Hi,"
    content = f"""
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">{greeting}</p>
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
  We received a request to reset your Brandora AI password. Click the button below to choose a new password.
  This link expires in <strong>1 hour</strong>.
</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
  <tr>
    <td style="background:#7c3aed;border-radius:10px;padding:14px 28px;">
      <a href="{reset_url}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
        Reset my password
      </a>
    </td>
  </tr>
</table>
<p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 8px;">
  Or copy and paste this URL into your browser:
</p>
<p style="color:#7c3aed;font-size:13px;word-break:break-all;margin:0 0 24px;">{reset_url}</p>
<p style="color:#9ca3af;font-size:13px;margin:0;">
  If you didn't request a password reset, you can safely ignore this email.
</p>"""
    html = _base_template("Reset your password", content)
    text = f"Reset your Brandora AI password:\n{reset_url}\n\nThis link expires in 1 hour."
    return await send_email(to, "Reset your Brandora AI password", html, text)


async def send_team_invite_email(
    to: str,
    inviter_name: str,
    org_name: str,
    role: str,
    invitee_name: str = "",
) -> bool:
    login_url = f"{settings.FRONTEND_URL}/login"
    register_url = f"{settings.FRONTEND_URL}/register"
    greeting = f"Hi {invitee_name}," if invitee_name else "Hi,"
    content = f"""
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">{greeting}</p>
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
  <strong>{inviter_name}</strong> has added you to <strong>{org_name}</strong> on Brandora AI as a <strong>{role}</strong>.
</p>
<p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
  Log in to start collaborating on social media content for your organization.
</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
  <tr>
    <td style="background:#7c3aed;border-radius:10px;padding:14px 28px;">
      <a href="{login_url}" style="color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">
        Log in to Brandora AI
      </a>
    </td>
  </tr>
</table>
<p style="color:#9ca3af;font-size:13px;margin:0;">
  Don't have an account yet?
  <a href="{register_url}" style="color:#7c3aed;">Register here</a>
</p>"""
    html = _base_template(f"You've been added to {org_name}", content)
    text = (
        f"{inviter_name} added you to {org_name} on Brandora AI as {role}.\n"
        f"Log in: {login_url}"
    )
    return await send_email(to, f"You've been added to {org_name} on Brandora AI", html, text)
