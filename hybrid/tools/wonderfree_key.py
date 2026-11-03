#!/usr/bin/env python3
"""Acquire *your own* P2001E Plus LAN authKey from WonderFree/Quectel EU.

Standalone Python 3 tool. Does not save account password, token or authKey to disk.
Based on protocol research: bordeux/ha-oukitel-powerstation (MIT).
Unverified with user's firmware/account; vendor may change endpoints.
"""
import base64
import getpass
import hashlib
import json
import secrets
import subprocess
import sys
import urllib.parse
import urllib.request
import uuid

BASE="https://iot-api.quecteleu.com"
DOMAIN="E.SP.4294967410"
APP_SECRET="3aRNUwWahjyANa7WfBK2wCCkxCexB6nXxKJwXxfePvzf"
ALPHABET="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

def request(path, data, token=None, json_mode=False, method="POST"):
    headers={"X-Q-Language":"en","quec-random-url":str(uuid.uuid4()),"app-info":"[Pixel][Google][raven][33]"}
    if token:headers["Authorization"]=token
    if method=="GET":
        url=BASE+path+"?"+urllib.parse.urlencode(data)
        req=urllib.request.Request(url,headers=headers)
    else:
        body=json.dumps(data).encode() if json_mode else urllib.parse.urlencode(data).encode()
        headers["Content-Type"]="application/json" if json_mode else "application/x-www-form-urlencoded"
        req=urllib.request.Request(BASE+path,data=body,headers=headers)
    with urllib.request.urlopen(req,timeout=20) as response:
        result=json.load(response)
    if not isinstance(result,dict):raise RuntimeError("Unexpected cloud response")
    return result

def login(email,password):
    nonce="".join(secrets.choice(ALPHABET) for _ in range(16))
    secret=hashlib.md5(nonce.encode()).hexdigest().upper()[8:24]
    iv=secret[8:16]+secret[:8]
    proc=subprocess.run(["openssl","enc","-aes-128-cbc","-K",secret.encode().hex(),"-iv",iv.encode().hex()],input=password.encode(),capture_output=True,check=True)
    encrypted=base64.encodebytes(proc.stdout).decode()
    sign=hashlib.sha256((email+encrypted+nonce+APP_SECRET).encode()).hexdigest()
    result=request("/v2/enduser/enduserapi/emailPwdLogin",{"email":email,"pwd":encrypted,"random":nonce,"signature":sign,"userDomain":DOMAIN})
    token=((result.get("data") or {}).get("accessToken") or {}).get("token")
    if not token:raise RuntimeError("WonderFree login failed; check region and account")
    return token

def main():
    print("WonderFree EU → OUKITEL local authKey")
    print("Only enter your OWN account credentials. The password is not stored.")
    email=input("WonderFree email: ").strip()
    password=getpass.getpass("WonderFree password (hidden): ")
    token=login(email,password)
    del password
    result=request("/v2/binding/enduserapi/userDeviceList",{"pageNumber":"1","pageSize":"50"},token,method="GET")
    obj=result.get("data") or {}
    items=obj.get("list") if isinstance(obj,dict) else obj
    if not isinstance(items,list):raise RuntimeError("Unexpected device list format")
    devices=[d for d in items if isinstance(d,dict) and (d.get("pk") or d.get("productKey")) and (d.get("dk") or d.get("deviceKey"))]
    if not devices:raise RuntimeError("No devices bound to this WonderFree account")
    for i,d in enumerate(devices,1):print(f"{i}. {d.get('deviceName') or d.get('pk') or 'Station'}")
    chosen=int(input("Device number: "))
    if not 1<=chosen<=len(devices):raise RuntimeError("Invalid choice")
    device=devices[chosen-1]
    payload={"pk":device.get("pk") or device.get("productKey"),"dk":device.get("dk") or device.get("deviceKey")}
    reply=request("/v2/binding/enduserapi/regenerateAuthKey",payload,token,json_mode=True)
    data=reply.get("data") or {}
    key=data.get("authKey") if isinstance(data,dict) else None
    if not isinstance(key,str) or len(base64.b64decode(key))!=16:raise RuntimeError("Cloud did not return a valid 16-byte authKey")
    print("\nDevice:",device.get("deviceName") or payload["pk"])
    print("authKey (enter in PowerHub on iPhone, never publish):",key)
    print("\nThis tool does not write the key or credentials to disk.")
if __name__=="__main__":
    try:main()
    except (ValueError,KeyError,RuntimeError,subprocess.CalledProcessError,Exception) as e:
        print("Unable to obtain key:",str(e),file=sys.stderr)
        sys.exit(1)
