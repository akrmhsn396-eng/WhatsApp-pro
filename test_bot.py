import urllib.request
import urllib.parse

TOKEN = "glpat-ZmCqUvLA9jxWr9GXfTK_tGM6MQpvOjEKdTpxaXFueA8.01.170lnamkr"
CHAT_ID = "1691578822"
MESSAGE = "Hello Akram! The bot is connected successfully."

url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": MESSAGE}).encode("utf-8")

req = urllib.request.Request(url, data=data)
try:
    with urllib.request.urlopen(req) as response:
        print("Message sent successfully!")
except Exception as e:
    print("Error:", e)
