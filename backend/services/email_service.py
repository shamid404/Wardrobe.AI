import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from ..config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM


def send_verification_email(to_email: str, code: str, name: str) -> None:
    sender = SMTP_FROM or SMTP_USER

    if not SMTP_USER or not SMTP_PASSWORD:
        # Dev fallback: print to console instead of failing
        print(f"\n[EMAIL VERIFICATION] To: {to_email} | Code: {code}\n")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your Wardrobe.ai verification code: {code}"
    msg["From"] = sender
    msg["To"] = to_email

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F0E4;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#FAF5EE;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(60,40,20,0.10);">
        <!-- Header -->
        <tr>
          <td style="background:#2D2218;padding:28px 40px;text-align:center;">
            <span style="font-family:Georgia,serif;font-size:32px;font-weight:600;color:#FAF5EE;letter-spacing:1px;">W</span>
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#FAF5EE;margin-left:6px;">Wardrobe</span>
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:400;color:#C8826D;">.ai</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#2D2218;">Hi, {name}!</p>
            <p style="margin:0 0 28px;font-size:15px;color:#7A6B5C;line-height:1.6;">
              Use the code below to confirm your email address and complete your registration on Wardrobe.ai.
            </p>
            <!-- Code box -->
            <div style="background:#F4ECE0;border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
              <span style="font-size:42px;font-weight:700;letter-spacing:12px;color:#2D2218;font-family:'Courier New',monospace;">{code}</span>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#A89A8A;text-align:center;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="margin:0;font-size:13px;color:#A89A8A;text-align:center;">
              If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px 28px;border-top:1px solid #EDE3D4;text-align:center;">
            <p style="margin:0;font-size:12px;color:#C0B0A0;">© 2025 Wardrobe.ai — Your closet, reimagined</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""
    msg.attach(MIMEText(html, "html"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.ehlo()
        server.starttls(context=ctx)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(sender, to_email, msg.as_string())
