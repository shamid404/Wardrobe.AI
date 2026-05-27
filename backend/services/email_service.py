import httpx

from ..config import RESEND_API_KEY, SMTP_FROM


def send_verification_email(to_email: str, code: str, name: str) -> None:
    sender = SMTP_FROM or "onboarding@resend.dev"

    if not RESEND_API_KEY:
        print(f"\n[EMAIL VERIFICATION] To: {to_email} | Code: {code}\n")
        return

    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F8F0E4;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#FAF5EE;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(60,40,20,0.10);">
        <tr>
          <td style="background:#2D2218;padding:28px 40px;text-align:center;">
            <span style="font-family:Georgia,serif;font-size:32px;font-weight:600;color:#FAF5EE;letter-spacing:1px;">W</span>
            <span style="font-family:Georgia,serif;font-size:22px;font-weight:400;color:#FAF5EE;margin-left:6px;">Wardrobe</span>
            <span style="font-family:Georgia,serif;font-size:16px;font-weight:400;color:#C8826D;">.ai</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#2D2218;">Hi, {name}!</p>
            <p style="margin:0 0 28px;font-size:15px;color:#7A6B5C;line-height:1.6;">
              Use the code below to confirm your email address and complete your registration on Wardrobe.ai.
            </p>
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

    response = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
        json={
            "from": sender,
            "to": [to_email],
            "subject": f"Your Wardrobe.ai verification code: {code}",
            "html": html,
        },
        timeout=10,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Resend error {response.status_code}: {response.text}")
