// PowerHub OUKITEL P2001E Plus: Quectel local TCP 6607 / TTLV / AES-CBC.
// Source protocol attribution: bordeux/ha-oukitel-powerstation (MIT), independent implementation.
// The authKey is supplied by the user at runtime, never baked into the app or repository.
import { TCPClient } from '@devioarts/capacitor-tcpclient';

const enc = new TextEncoder();
const dec = new TextDecoder();
const U16 = n => [(n>>>8)&255,n&255];
const decode16 = (a,i) => (a[i]<<8)|a[i+1];
const keyBytes = str => Uint8Array.from(atob(str.trim()),c=>c.charCodeAt(0));
function pack(pid,cmd,payload=[]) {
  const body=[...U16(pid),...U16(cmd),...payload],length=body.length+1;
  const raw=[170,170,...U16(length),body.reduce((a,x)=>(a+x)&255,0),...body], out=raw.slice(0,2);
  for(let i=2;i<raw.length;i++){out.push(raw[i]);if(raw[i]===170&&i+1<raw.length&&(raw[i+1]===170||raw[i+1]===85))out.push(85)}
  return out;
}
function ttlv(fields) {
  const result=[];
  for(const [tag,type,value] of fields){
    if(type==='bool'){result.push(...U16(tag*8+(value?1:0)));continue}
    if(type==='num'){
      let n=Math.abs(Number(value)),bytes=[];
      do{bytes.unshift(n&255);n=Math.floor(n/256)}while(n);
      result.push(...U16(tag*8+2),(value<0?128:0)+(bytes.length-1),...bytes);
    }else if(type==='string'){const b=enc.encode(value);result.push(...U16(tag*8+3),...U16(b.length),...b)}
  }
  return result;
}
function parseTTLV(input) {
  const b=Array.from(input);let i=0;const out={};
  const number=()=>{if(i>=b.length)throw Error('Truncated number');const c=b[i++],len=(c&7)+1;if(i+len>b.length)throw Error('Truncated number body');let value=0;for(let j=0;j<len;j++)value=value*256+b[i++];if(c&128)value=-value;return value/(10**((c>>3)&15))};
  const readField=(depth=0)=>{
    if(i+2>b.length)throw Error('Truncated TTLV header');
    const h=decode16(b,i);i+=2;const tag=h>>3,type=h&7;
    if(type<=1)return [tag,type===1];
    if(type===2)return [tag,number()];
    if(type===3||type===5){if(i+2>b.length)throw Error('Truncated length');const len=decode16(b,i);i+=2;if(i+len>b.length)throw Error('Truncated bytes');const v=b.slice(i,i+len);i+=len;return [tag,dec.decode(new Uint8Array(v))]}
    if(type===4&&depth<3){if(i+2>b.length)throw Error('Truncated struct');const count=decode16(b,i);i+=2;if(count>100)throw Error('Struct too large');const sub={};for(let j=0;j<count;j++){const [t,v]=readField(depth+1);sub[t]=v}return [tag,sub]}
    throw Error('Unsupported TTLV type: '+type);
  };
  while(i<b.length){const [t,v]=readField();out[t]=v}
  return out;
}
function assembler(onFrame) {
  let buffer=[],prevAA=false;
  return chunk => {
    for(const byte of chunk){
      if(prevAA&&byte===85){prevAA=false;continue}
      buffer.push(byte);prevAA=byte===170;
    }
    while(buffer.length>=9){
      if(buffer[0]!==170||buffer[1]!==170){buffer.shift();continue}
      const length=decode16(buffer,2),total=length+4;
      if(length<5||length>16384){buffer.shift();continue}
      if(buffer.length<total)break;
      const frame=buffer.splice(0,total),body=frame.slice(5);
      if(body.reduce((a,x)=>(a+x)&255,0)!==frame[4])continue;
      onFrame({pid:decode16(frame,5),cmd:decode16(frame,7),payload:frame.slice(9)});
    }
  };
}

export class OukitelLocal {
  constructor({onStatus=()=>{},onData=()=>{}}={}) {
    this.status=onStatus;this.onData=onData;this.conn=null;this.ready=false;this.pid=1000;this.queue=Promise.resolve();this.waiters=new Map();
    this.values={};this.authKey=null;this.iv=null;this.heartbeat=null;this.lastFrame=0;this.connected=false;
    this.consume=assembler(frame=>this.queue=this.queue.then(()=>this.handle(frame)).catch(e=>this.status('Помилка розбору: '+e.message)));
  }
  nextPid(){this.pid=this.pid>=65534?1000:this.pid+1;return this.pid}
  async send(cmd,fields=[],encrypted=false) {
    if(!this.conn)throw Error('Немає TCP з’єднання');
    let payload=Uint8Array.from(fields);
    if(encrypted)payload=new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC',iv:this.iv},this.aesKey,payload));
    const pid=this.nextPid(),result=await this.conn.write({data:pack(pid,cmd,[...payload])});
    if(result?.error)throw Error(result.errorMessage||'TCP write failed');
    return pid;
  }
  async connect(host,authKeyB64) {
    if(this.conn)await this.disconnect();
    if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||host.split('.').some(n=>Number(n)>255))throw Error('Вкажи локальну IPv4-адресу станції');
    const bytes=keyBytes(authKeyB64);
    if(bytes.length!==16)throw Error('authKey має декодуватися в 16 байтів AES');
    this.authKey=bytes;this.aesKey=await crypto.subtle.importKey('raw',bytes,'AES-CBC',false,['encrypt','decrypt']);
    this.values={};this.iv=null;this.ready=false;this.lastFrame=0;
    this.conn=TCPClient.createConnection({host,port:6607,timeout:10000});
    const c=await this.conn.connect();if(c.error||!c.connected)throw Error(c.errorMessage||'TCP 6607 недоступний');
    this.connected=true;
    await this.conn.addListener('tcpData',e=>this.consume(e.data));
    await this.conn.addListener('tcpDisconnect',()=>{this.ready=false;this.connected=false;clearInterval(this.heartbeat);this.status('OUKITEL від’єднано')});
    const reader=await this.conn.startRead({chunkSize:4096});if(reader?.error)throw Error(reader.errorMessage||'Не вдається читати TCP');
    this.status('TCP підключено, проходжу авторизацію…');
    await this.send(28722);
  }
  async handle(frame) {
    this.lastFrame=Date.now();
    if(frame.cmd===28723) {
      const fields=parseTTLV(frame.payload);
      const nonce=Object.values(fields).find(v=>typeof v==='string'&&v.length===16);
      if(!nonce)throw Error('Невідомий nonce станції');
      this.iv=enc.encode(nonce);
      const hex=[...this.authKey].map(x=>x.toString(16).padStart(2,'0')).join('');
      const digest=await crypto.subtle.digest('SHA-256',enc.encode(hex+';'+nonce));
      const token=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
      await this.send(28724,ttlv([[2,'string',token]]));
      return;
    }
    if(frame.cmd===28725) {
      const fields=parseTTLV(frame.payload),code=Object.values(fields).find(v=>typeof v==='number');
      if(code!==0&&code!==2)throw Error('OUKITEL відхилив авторизацію: '+code);
      this.ready=true;this.status('Авторизовано — очікую телеметрію');
      await this.subscribe();
      clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(this.ready)this.subscribe().catch(e=>this.status('Повтор підписки: '+e.message))},12000);
      return;
    }
    if(frame.cmd===28727){await this.send(28728);return}
    if(frame.cmd===28726)return;
    if(!this.ready||!frame.payload.length||!this.iv)return;
    if(frame.payload.length%16!==0)return;
    const clear=new Uint8Array(await crypto.subtle.decrypt({name:'AES-CBC',iv:this.iv},this.aesKey,Uint8Array.from(frame.payload)));
    const values=parseTTLV(clear);
    if(Object.keys(values).length){Object.assign(this.values,values);this.onData({...this.values},Date.now())}
  }
  async subscribe() {
    // tag 100 = 3 enables LAN Wi-Fi reports, then read selected telemetry tags.
    await this.send(19,ttlv([[100,'num',3]]),true);
    const tags=[2,8,9,6,31,7,28,27,14,12,11,5,4,3,1,34,20,100,43,44,46];
    await this.send(17,tags.flatMap(U16),true);
    await this.send(28729,[0,10,0,30,0,18,0,1],true);
  }
  async setOutput(tag,enabled) {
    if(!this.ready)throw Error('Станція не авторизована');
    if(![43,44,46].includes(tag))throw Error('Недозволений керувальний тег');
    await this.send(19,ttlv([[tag,'bool',enabled]]),true);
    // Do NOT optimistically report the desired state: actual status comes from station.
    this.status('Команду надіслано. Очікую підтвердження телеметрією…');
    await this.send(17,U16(tag),true);
  }
  async disconnect() {
    clearInterval(this.heartbeat);this.ready=false;this.connected=false;
    if(this.conn){const c=this.conn;this.conn=null;await c.destroy().catch(()=>{})}
    this.status('OUKITEL від’єднано');
  }
}
