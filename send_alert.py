import urllib.request
import urllib.parse
import sys

TOKEN = "9117368974:AAGswTYJNBj86iUDF_RLqAwwIYfIKQXOArw"
CHAT_ID = "1691578822"

def send_message(text):
    url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": text}).encode("utf-8")
    req = urllib.request.Request(url, data=data)
    try:
        with urllib.request.urlopen(req) as response:
            print("Telegram alert sent successfully!")
    except Exception as e:
        print("Failed to send alert:", e)

if __name__ == "__main__":
    msg = sys.argv[1] if len(sys.argv) > 1 else "Hello from WhatsApp-pro project!"
    send_message(msg)
